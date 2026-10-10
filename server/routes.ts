import { Router, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { db, UserProfileRecord } from './db.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  requireAuth,
  optionalAuth,
  AuthenticatedRequest,
} from './auth.js';
import { executeCodeInSandbox } from './codeRunner.js';
import {
  isGeminiConfigured,
  askCareerCoach,
  evaluateMockInterview,
  evaluateSingleAnswer,
  generateRivalReplay,
} from './gemini.js';
import { QUESTION_BANK, CODING_CHALLENGES } from './seedQuestions.js';

export const apiRouter = Router();

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(scope: string, limit: number, windowMs: number) {
  return (req: any, res: Response, next: any) => {
    const now = Date.now();
    const key = `${scope}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    let bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    if (rateBuckets.size > 10000) {
      for (const [entry, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(entry);
    }
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    next();
  };
}
const validEmail = (value: unknown): value is string => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const validPassword = (value: unknown): value is string => typeof value === 'string' && value.length >= 8 && value.length <= 128;

// --- System & Status ---
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Ease Career',
    time: new Date().toISOString(),
    geminiConfigured: isGeminiConfigured(),
  });
});

// --- Authentication ---
apiRouter.post('/auth/register', rateLimit('register', 5, 15 * 60_000), async (req, res) => {
  const { email, password, name } = req.body && typeof req.body === 'object' ? req.body : {};

  if (!validEmail(email) || !validPassword(password) || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    return res.status(400).json({ error: 'Enter a valid email, a name up to 100 characters, and a password of 8–128 characters.' });
  }

  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  const passwordHash = await hashPassword(password);
  const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const newUser = db.createUser({
    id,
    email: email.toLowerCase().trim(),
    passwordHash,
    name: name.trim(),
    emailVerified: true, // Auto-verified for streamlined onboarding
    createdAt: new Date().toISOString(),
  });

  const token = generateToken(newUser);
  const stats = db.getUserStats(newUser.id);

  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      createdAt: newUser.createdAt,
    },
    stats,
  });
});

apiRouter.post('/auth/login', rateLimit('login', 10, 15 * 60_000), async (req, res) => {
  const { email, password } = req.body && typeof req.body === 'object' ? req.body : {};

  if (!validEmail(email) || typeof password !== 'string' || !password || password.length > 128) {
    return res.status(400).json({ error: 'A valid email and password are required.' });
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = generateToken(user);
  const profile = db.getProfile(user.id);
  const stats = db.getUserStats(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    profile,
    stats,
  });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const profile = db.getProfile(user.id);
  const stats = db.getUserStats(user.id);
  const assessments = db.getAssessments(user.id);
  const roadmap = db.getRoadmap(user.id);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    profile,
    stats,
    activities: db.getActivities(user.id).slice(0, 15),
    hasCompletedAssessment: assessments.length > 0,
    latestAssessment: assessments[0] || null,
    hasRoadmap: !!roadmap,
  });
});

apiRouter.get('/user/activities', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const activities = db.getActivities(req.user!.id);
  res.json({ activities });
});

apiRouter.post('/auth/forgot-password', rateLimit('password-reset', 5, 60 * 60_000), async (req, res) => {
  const { email } = req.body && typeof req.body === 'object' ? req.body : {};
  if (!validEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });

  const deliveryUrl = process.env.PASSWORD_RESET_DELIVERY_URL;
  const deliveryToken = process.env.PASSWORD_RESET_DELIVERY_TOKEN;
  if (!deliveryUrl || !deliveryToken) return res.status(503).json({ error: 'Password recovery delivery is not configured.' });
  try {
    const parsedUrl = new URL(deliveryUrl);
    if (parsedUrl.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsedUrl.hostname === 'localhost')) {
      return res.status(503).json({ error: 'Password recovery delivery must use HTTPS.' });
    }
  } catch {
    return res.status(503).json({ error: 'Password recovery delivery is not configured correctly.' });
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    // For security, do not reveal if email exists
    return res.json({ message: 'If an account exists and password recovery is configured, reset instructions will be sent.' });
  }
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  try {
    const delivery = await fetch(deliveryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deliveryToken}` },
      body: JSON.stringify({ to: user.email, subject: 'Ease Career password reset', text: `Your password reset code is ${token}. It expires in 30 minutes.` }),
      signal: AbortSignal.timeout(5000),
    });
    if (!delivery.ok) throw new Error('Delivery service rejected reset message');
    db.updateUser(user.id, { resetToken: tokenHash, resetTokenExpires: Date.now() + 30 * 60_000 });
    return res.json({ message: 'If an account exists, reset instructions will be sent.' });
  } catch {
    return res.json({ message: 'If an account exists and recovery is available, reset instructions will be sent.' });
  }
});

apiRouter.post('/auth/reset-password', rateLimit('password-reset', 5, 60 * 60_000), async (req, res) => {
  const { email, token, newPassword } = req.body && typeof req.body === 'object' ? req.body : {};
  if (!validEmail(email) || typeof token !== 'string' || token.length !== 64 || !validPassword(newPassword)) {
    return res.status(400).json({ error: 'Enter a valid email, reset token, and password of 8–128 characters.' });
  }

  const user = db.findUserByEmail(email);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  if (!user || !user.resetToken || user.resetToken !== tokenHash || !user.resetTokenExpires || user.resetTokenExpires <= Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }

  if (!db.consumePasswordResetToken(user.id, tokenHash)) {
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }
  const passwordHash = await hashPassword(newPassword);
  db.updateUser(user.id, { passwordHash, tokenVersion: (user.tokenVersion || 0) + 1 });

  res.json({ message: 'Password has been reset successfully. You may now sign in.' });
});

// --- Onboarding ---
apiRouter.post('/onboarding', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const {
    field,
    company,
    role,
    experienceLevel,
    preferredLanguage = 'JavaScript',
    studyHoursPerDay = 2,
    targetTimelineWeeks = 12,
  } = req.body;

  if (!field || !company || !role || !experienceLevel) {
    return res.status(400).json({ error: 'Field, company, role, and experience level are required.' });
  }

  const profile: UserProfileRecord = {
    userId,
    field,
    company,
    role,
    experienceLevel,
    preferredLanguage,
    studyHoursPerDay,
    targetTimelineWeeks,
    updatedAt: new Date().toISOString(),
  };

  db.saveProfile(profile);
  db.addXp(userId, 50, 'Orientation Completed');
  db.logActivity({
    id: 'act_' + Date.now(),
    userId,
    type: 'onboarding',
    title: 'Career Target Configured',
    detail: `Targeting ${company} • ${role} (${experienceLevel})`,
    xpEarned: 50,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, profile });
});

// --- Role Assessment ---
apiRouter.get('/assessment/questions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const profile = db.getProfile(req.user!.id);
  const targetCompany = (req.query.company as string) || profile?.company || 'Google';
  const targetRole = (req.query.role as string) || profile?.role || 'Software Engineer';
  const targetField = (req.query.field as string) || profile?.field || 'Software Development';

  // Only take questions that strictly have valid options array and a defined correctAnswer
  const validMcqs = QUESTION_BANK.filter(
    (q) => q.options && Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctAnswer === 'number'
  );

  // Filter matching questions by company or field/role
  let matched = validMcqs.filter(
    (q) =>
      (q.company === targetCompany || q.company === 'General') &&
      (q.role.toLowerCase().includes(targetRole.toLowerCase()) || q.field === targetField)
  );

  // If matched questions are fewer than 5, supplement with other questions from the same field
  if (matched.length < 5) {
    const fieldQuestions = validMcqs.filter(
      (q) => q.field === targetField && !matched.some((m) => m.id === q.id)
    );
    matched = [...matched, ...fieldQuestions];
  }

  // If still fewer than 5, supplement with other questions in the bank
  if (matched.length < 5) {
    const fallbackQuestions = validMcqs.filter(
      (q) => !matched.some((m) => m.id === q.id)
    );
    matched = [...matched, ...fallbackQuestions];
  }

  // Deduplicate by question id
  const seen = new Set<string>();
  const uniqueQuestions = matched.filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  }).slice(0, 5);

  res.json({
    role: targetRole,
    company: targetCompany,
    field: targetField,
    questions: uniqueQuestions.map((q) => ({
      id: q.id,
      topic: q.topic,
      skill: q.skill,
      difficulty: q.difficulty,
      question: q.question,
      codeSnippet: q.codeSnippet,
      options: q.options || [],
      // correctAnswer omitted to prevent cheating before submission
    })),
  });
});

apiRouter.post('/assessment/submit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { answers } = req.body; // Record<string, number>
  const profile = db.getProfile(userId);

  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Submitted answers object is required.' });
  }

  let correctCount = 0;
  let totalEvaluated = 0;
  const demonstrated: string[] = [];
  const improvement: string[] = [];
  const answerBreakdown: any[] = [];

  Object.entries(answers).forEach(([questionId, chosenOption]) => {
    const q = QUESTION_BANK.find((item) => item.id === questionId);
    if (!q) return;

    totalEvaluated += 1;
    const isCorrect = chosenOption === q.correctAnswer;
    if (isCorrect) {
      correctCount += 1;
      if (!demonstrated.includes(q.skill)) demonstrated.push(q.skill);
    } else {
      if (!improvement.includes(q.skill)) improvement.push(q.skill);
    }

    answerBreakdown.push({
      questionId: q.id,
      question: q.question,
      skill: q.skill,
      chosenOption,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation,
    });
  });

  const percentage = totalEvaluated > 0 ? Math.round((correctCount / totalEvaluated) * 100) : 0;

  const attemptId = 'atm_' + Date.now();
  const attempt = db.addAssessment({
    id: attemptId,
    userId,
    field: profile?.field || 'Software Development',
    company: profile?.company || 'Google',
    role: profile?.role || 'Software Engineer',
    score: correctCount,
    total: totalEvaluated,
    percentage,
    answers,
    demonstratedSkills: demonstrated.length > 0 ? demonstrated : ['Foundational Programming'],
    improvementSkills: improvement.length > 0 ? improvement : ['Advanced System Design'],
    createdAt: new Date().toISOString(),
  });

  // Award XP for completing assessment
  const xpAwarded = 150 + correctCount * 30;
  db.addXp(userId, xpAwarded, 'Assessment Verified');
  db.logActivity({
    id: 'act_' + Date.now(),
    userId,
    type: 'assessment',
    title: 'Diagnostic Assessment Completed',
    detail: `Score: ${percentage}% (${correctCount}/${totalEvaluated} correct) for ${profile?.company || 'Target'}`,
    score: percentage,
    xpEarned: xpAwarded,
    timestamp: new Date().toISOString(),
  });

  // Automatically construct/update the personalized roadmap based on assessment outcome
  const initialRoadmapSkills: any[] = [
    {
      id: 'skill-core-1',
      name: 'Data Structures: Arrays, Two-Pointers & Binary Search',
      category: 'core',
      difficulty: 'Beginner',
      description: 'Foundational array transformations, binary search invariants, and O(1) space optimizations.',
      estimatedHours: 15,
      prerequisites: [],
      status: demonstrated.some((s) => s.includes('Data Structures')) ? 'completed' : 'available',
      progress: demonstrated.some((s) => s.includes('Data Structures')) ? 100 : 25,
      completed: demonstrated.some((s) => s.includes('Data Structures')),
    },
    {
      id: 'skill-core-2',
      name: 'Non-Linear Structures: Trees, Graphs & BFS/DFS',
      category: 'core',
      difficulty: 'Intermediate',
      description: 'Topological sort, cycle detection in dependencies, and shortest path traversals.',
      estimatedHours: 25,
      prerequisites: ['skill-core-1'],
      status: 'available',
      progress: 0,
      completed: false,
    },
    {
      id: 'skill-specialized-1',
      name: `${profile?.company || 'Company'} Concurrency & System Reliability`,
      category: 'specialized',
      difficulty: 'Advanced',
      description: 'Race condition prevention, thread synchronization, mutex locks, and distributed caching.',
      estimatedHours: 35,
      prerequisites: ['skill-core-1', 'skill-core-2'],
      status: 'locked',
      progress: 0,
      completed: false,
    },
    {
      id: 'skill-architecture-1',
      name: `${profile?.role || 'Role'} System Architecture & Edge Cases`,
      category: 'architecture',
      difficulty: 'Advanced',
      description: 'Architecting fault-tolerant services that scale to millions of concurrent requests.',
      estimatedHours: 40,
      prerequisites: ['skill-specialized-1'],
      status: 'locked',
      progress: 0,
      completed: false,
    },
  ];

  db.saveRoadmap({
    userId,
    role: profile?.role || 'Software Engineer',
    skills: initialRoadmapSkills,
    updatedAt: new Date().toISOString(),
  });

  res.json({
    attempt,
    breakdown: answerBreakdown,
  });
});

// --- Roadmap & Checkpoints ---
apiRouter.get('/roadmap', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const roadmap = db.getRoadmap(userId);
  const profile = db.getProfile(userId);

  if (!roadmap) {
    return res.json({ roadmap: null, message: 'Please complete orientation and assessment to generate your roadmap.' });
  }

  res.json({
    roadmap: roadmap.skills,
    role: profile?.role || roadmap.role,
    company: profile?.company || 'Google',
    updatedAt: roadmap.updatedAt,
  });
});

apiRouter.post('/roadmap/skill/:skillId/checkpoint', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { skillId } = req.params;
  const roadmap = db.getRoadmap(userId);

  if (!roadmap) {
    return res.status(404).json({ error: 'No roadmap found.' });
  }

  const skill = roadmap.skills.find((s) => s.id === skillId);
  if (!skill) {
    return res.status(404).json({ error: 'Skill not found in roadmap.' });
  }

  // Mark skill as completed
  skill.completed = true;
  skill.progress = 100;
  skill.status = 'completed';
  skill.completedAt = new Date().toISOString();

  // Unlock downstream dependent skills whose prerequisites are now satisfied
  roadmap.skills.forEach((s) => {
    if (s.status === 'locked' && s.prerequisites.length > 0) {
      const allPrereqsDone = s.prerequisites.every((pId) => {
        const prereq = roadmap.skills.find((ps) => ps.id === pId);
        return prereq && prereq.completed;
      });
      if (allPrereqsDone) {
        s.status = 'available';
      }
    }
  });

  roadmap.updatedAt = new Date().toISOString();
  db.saveRoadmap(roadmap);
  db.addXp(userId, 100, 'Skill Mastered');
  db.logActivity({
    id: 'act_' + Date.now(),
    userId,
    type: 'roadmap',
    title: `Mastered Skill: ${skill.name}`,
    detail: `Verified checkpoint completed (${skill.category} / ${skill.difficulty})`,
    xpEarned: 100,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, updatedSkill: skill, roadmap: roadmap.skills });
});

// --- Coding Challenges & Runner ---
apiRouter.get('/challenges', (req, res) => {
  res.json({ challenges: CODING_CHALLENGES, runnerConfigured: Boolean(process.env.CODE_RUNNER_URL && process.env.CODE_RUNNER_TOKEN) });
});

apiRouter.get('/challenges/:id', (req, res) => {
  const challenge = CODING_CHALLENGES.find((c) => c.id === req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
  res.json({ challenge });
});

apiRouter.post('/challenges/:id/run', rateLimit('code-run', 10, 60_000), requireAuth, async (req, res) => {
  const { code, language = 'javascript' } = req.body;
  const challenge = CODING_CHALLENGES.find((c) => c.id === req.params.id);

  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
  if (typeof code !== 'string' || !code.trim() || code.length > 50_000) return res.status(400).json({ error: 'Code must contain 1–50,000 characters.' });
  if (!['javascript', 'python'].includes(language)) return res.status(400).json({ error: 'Unsupported language.' });

  // Run only visible test cases for quick dry run
  const visibleCases = challenge.testCases.filter((tc) => !tc.isHidden);
  const result = await executeCodeInSandbox(code, language, challenge.entryFunction, visibleCases);

  res.json({ result });
});

apiRouter.post('/challenges/:id/submit', rateLimit('code-submit', 5, 60_000), requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { code, language = 'javascript', timeSpentSeconds = 120 } = req.body;
  const challenge = CODING_CHALLENGES.find((c) => c.id === req.params.id);

  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
  if (typeof code !== 'string' || !code.trim() || code.length > 50_000) return res.status(400).json({ error: 'Code must contain 1–50,000 characters.' });
  if (!['javascript', 'python'].includes(language)) return res.status(400).json({ error: 'Unsupported language.' });

  // Run full test suite (including hidden edge cases)
  const execution = await executeCodeInSandbox(code, language, challenge.entryFunction, challenge.testCases);
  const hiddenIds = new Set(challenge.testCases.filter((test) => test.isHidden).map((test) => test.id));
  const publicExecution = {
    ...execution,
    results: execution.results.map((result) => hiddenIds.has(result.id)
      ? { id: result.id, passed: result.passed, input: 'Hidden test', expected: 'Hidden', actual: 'Hidden', timeMs: result.timeMs, isHidden: true }
      : result),
  };

  let rivalReplay = null;
  try {
    if (!execution.error) rivalReplay = await generateRivalReplay({
      problemTitle: challenge.title,
      problemDesc: challenge.description,
      userCode: code,
      language,
      userPassed: execution.allPassed,
    });
  } catch {
    // fallback gracefully
  }

  if (req.user) {
    db.addSubmission({
      id: 'sub_' + Date.now(),
      userId: req.user.id,
      challengeId: challenge.id,
      code,
      language,
      status: execution.error ? 'error' : execution.allPassed ? 'passed' : 'failed',
      passedTests: execution.passedTests,
      totalTests: execution.totalTests,
      testResults: publicExecution.results,
      executionTimeMs: execution.executionTimeMs,
      createdAt: new Date().toISOString(),
    });

    if (execution.allPassed) {
      db.addXp(req.user.id, 200, 'Challenge Conquered');
    } else if (!execution.error) {
      db.addXp(req.user.id, 40);
    }

    db.logActivity({
      id: 'act_' + Date.now(),
      userId: req.user.id,
      type: 'challenge',
      title: execution.allPassed ? `Solved: ${challenge.title}` : `Attempted: ${challenge.title}`,
      detail: execution.error
        ? `Execution unavailable: ${execution.error}`
        : execution.allPassed
        ? `Passed all ${execution.totalTests} tests in ${language} (${execution.executionTimeMs}ms)`
        : `Passed ${execution.passedTests}/${execution.totalTests} tests in ${language}`,
      score: execution.totalTests ? Math.round((execution.passedTests / execution.totalTests) * 100) : 0,
      xpEarned: execution.allPassed ? 200 : execution.error ? 0 : 40,
      timestamp: new Date().toISOString(),
    });
  }

  res.json({
    execution: publicExecution,
    rivalReplay,
    userWon: execution.allPassed,
  });
});

// --- Interview Practice & Mock Interviews ---
apiRouter.get('/interviews', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const { company, role, difficulty, topic } = req.query;
  const userId = req.user?.id;
  const bookmarks = userId ? db.getBookmarks(userId) : [];
  const practiceRecords = userId ? db.getPracticeRecords(userId) : [];

  let list = QUESTION_BANK;
  if (company && typeof company === 'string' && company !== 'All') {
    list = list.filter((q) => q.company.toLowerCase() === company.toLowerCase() || q.company === 'General');
  }
  if (difficulty && typeof difficulty === 'string' && difficulty !== 'All') {
    list = list.filter((q) => q.difficulty.toLowerCase() === difficulty.toLowerCase());
  }

  const enriched = list.map((q) => {
    const isBookmarked = bookmarks.includes(q.id);
    const practice = practiceRecords.find((p) => p.questionId === q.id);
    return {
      ...q,
      isBookmarked,
      isPracticed: !!practice,
      userNotes: practice?.notes || '',
    };
  });

  res.json({ questions: enriched });
});

apiRouter.post('/interviews/:id/bookmark', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const isBookmarked = db.toggleBookmark(req.user!.id, req.params.id);
  res.json({ isBookmarked });
});

apiRouter.post('/interviews/:id/practice', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { notes = '' } = req.body;
  db.savePracticeRecord({
    userId: req.user!.id,
    questionId: req.params.id,
    notes,
    practicedAt: new Date().toISOString(),
  });
  db.addXp(req.user!.id, 40, 'Interview Practiced');
  res.json({ success: true });
});

apiRouter.post('/interview/evaluate-answer', rateLimit('interview-evaluation', 10, 60_000), requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { questionId, answer, company, role } = req.body && typeof req.body === 'object' ? req.body : {};

  if (typeof questionId !== 'string' || typeof answer !== 'string' || !answer.trim() || answer.length > 10_000) {
    return res.status(400).json({ error: 'A question ID and an answer of 1–10,000 characters are required.' });
  }
  if (answer.trim().length < 15) return res.status(400).json({ error: 'Please give a little more detail (at least 15 characters) for a useful interview evaluation.' });

  const questionItem = QUESTION_BANK.find((q) => q.id === questionId);
  if (!questionItem) return res.status(404).json({ error: 'Interview question not found.' });
  if (!isGeminiConfigured()) {
    return res.status(503).json({ error: 'Live interview feedback is unavailable. Configure GEMINI_API_KEY on the server.' });
  }
  const userProfile = db.getProfile(userId);
  const targetCompany = company || userProfile?.company || questionItem?.company || 'Google';
  const targetRole = role || userProfile?.role || questionItem?.role || 'Software Engineer';

  let evaluation;
  try {
    evaluation = await evaluateSingleAnswer({
      question: questionItem.question,
      topic: questionItem.topic || questionItem.skill,
      expectedKeyPoints: questionItem.expectedKeyPoints || questionItem.rubricCriteria || [],
      sampleAnswer: questionItem.sampleAnswer || '',
      rubricCriteria: questionItem.rubricCriteria || [],
      userAnswer: answer,
      company: targetCompany,
      role: targetRole,
    });
  } catch {
    return res.status(502).json({ error: 'Gemini could not evaluate the answer. Check the API key, quota, and connection.' });
  }

  // Save practice record
  db.savePracticeRecord({
    userId,
    questionId,
    notes: `${evaluation.verdict} (${evaluation.scorePercentage}%)`,
    practicedAt: new Date().toISOString(),
  });

  // Award XP based on answer quality
  const xpAward = evaluation.scorePercentage >= 80 ? 75 : evaluation.scorePercentage >= 50 ? 50 : 25;
  const stats = db.addXp(userId, xpAward, 'Interview Solution Evaluated');

  // Log activity
  db.logActivity({
    id: 'act_' + Date.now(),
    userId,
    type: 'interview',
    title: `Interview Answer Evaluated: ${questionItem?.topic || 'Technical Question'}`,
    detail: `${evaluation.verdict} (${evaluation.scorePercentage}%) • ${targetCompany}`,
    score: evaluation.scorePercentage,
    xpEarned: xpAward,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    evaluation,
    userStats: stats,
  });
});

apiRouter.post('/mock-interview/submit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { company, role, answers } = req.body; // answers: Record<questionId, textAnswer>

  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Answers payload is required.' });
  }

  const pairs = Object.entries(answers).map(([qId, textAns]) => {
    const q = QUESTION_BANK.find((item) => item.id === qId);
    return {
      question: q?.question || 'Technical Problem',
      answer: String(textAns),
      keyPoints: q?.rubricCriteria || ['Explain Big-O trade-offs', 'Provide structured approach'],
    };
  });

  const evaluation = await evaluateMockInterview({
    company: company || 'Google',
    role: role || 'Software Engineer',
    questionsAndAnswers: pairs,
  });

  const record = db.addMockInterview({
    id: 'mock_' + Date.now(),
    userId,
    company: company || 'Google',
    role: role || 'Software Engineer',
    answers,
    feedback: evaluation,
    score: evaluation.scorePercentage,
    createdAt: new Date().toISOString(),
  });

  db.addXp(userId, 200, 'Mock Interview Completed');
  db.logActivity({
    id: 'act_' + Date.now(),
    userId,
    type: 'interview',
    title: `Mock Interview Completed: ${company || 'General'}`,
    detail: `Score: ${evaluation.scorePercentage}% (${Object.keys(answers).length} questions evaluated)`,
    score: evaluation.scorePercentage,
    xpEarned: 200,
    timestamp: new Date().toISOString(),
  });

  res.json({ record, evaluation });
});

// --- AI Career Coach ---
apiRouter.post('/coach/chat', rateLimit('coach-chat', 20, 60_000), optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { message, chatHistory } = req.body;
  if (typeof message !== 'string' || !message.trim() || message.length > 8000) {
    return res.status(400).json({ error: 'Message must contain 1–8,000 characters.' });
  }
  if (chatHistory !== undefined && (!Array.isArray(chatHistory) || chatHistory.length > 10 ||
      chatHistory.some((item: any) => !item || !['user', 'model'].includes(item.role) || typeof item.text !== 'string' || item.text.length > 4000))) {
    return res.status(400).json({ error: 'Chat history must contain at most 10 valid messages.' });
  }

  const user = req.user;
  const profile = user ? db.getProfile(user.id) : null;
  const stats = user ? db.getUserStats(user.id) : null;

  const response = await askCareerCoach({
    userMessage: message,
    userContext: {
      name: user?.name || 'Engineer',
      field: profile?.field || 'Software Development',
      company: profile?.company || 'Google',
      role: profile?.role || 'Software Engineer',
      experienceLevel: profile?.experienceLevel || 'Intermediate',
      xp: stats?.xp || 0,
    },
    chatHistory,
  });

  res.json(response);
});

// --- Profile & Settings ---
apiRouter.post('/profile/reset', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  // Reset roadmaps, assessments, and stats for a clean retargeting slate
  const stats = db.getUserStats(userId);
  stats.xp = 0;
  stats.level = 1;
  stats.badges = [];
  db.saveUserStats(stats);
  res.json({ success: true, message: 'Career target reset successfully.' });
});
