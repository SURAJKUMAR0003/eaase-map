import React, { useState, useEffect } from 'react';
import { LampLogin } from './components/LampLogin.js';
import { OnboardingFlow } from './components/OnboardingFlow.js';
import { RoleAssessment } from './components/RoleAssessment.js';
import { SkillGapRoadmap } from './components/SkillGapRoadmap.js';
import { MainDashboard } from './components/MainDashboard.js';
import { DebugArena } from './components/DebugArena.js';
import { InterviewPractice } from './components/InterviewPractice.js';
import { AiCareerCoach } from './components/AiCareerCoach.js';
import { ProgressAnalytics } from './components/ProgressAnalytics.js';
import { AppNavbar } from './components/AppNavbar.js';
import {
  UserCareerProfile,
  CareerField,
  TargetCompany,
  ExperienceLevel,
  RoadmapSkill,
} from './types.js';
import { generateTailoredRoadmap } from './data/mockData.js';
import { api } from './services/api.js';

type AppStep = 'login' | 'onboarding' | 'assessment' | 'roadmap_reveal' | 'dashboard';

export default function App() {
  const [appStep, setAppStep] = useState<AppStep>('login');
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // User state
  const [user, setUser] = useState<UserCareerProfile>({
    name: 'Rahul Sharma',
    email: 'rahul.ece@college.edu',
    field: 'Software Development',
    company: 'Google',
    role: 'Software Development Engineer I',
    experienceLevel: 'Intermediate',
    xp: 450,
    streak: 5,
    level: 2,
    badges: ['Orientation Pioneer', 'Assessment Verified', '3-Day Streak'],
    assessmentCompleted: false,
  });

  // Roadmap skills state
  const [roadmapSkills, setRoadmapSkills] = useState<RoadmapSkill[]>(() =>
    generateTailoredRoadmap(
      'Software Development',
      'Google',
      'Software Development Engineer I',
      ['Two-Pointer Technique', 'Algorithmic Complexity & Big-O'],
      ['Distributed Caching & Concurrency', 'SOLID Principles']
    )
  );

  // Restore authenticated session on mount
  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setIsInitializing(false);
      return;
    }

    api.getMe()
      .then((data) => {
        if (data.user) {
          const profile = data.profile || {};
          const stats = data.stats || {};
          const hasAssessment = Boolean(data.hasCompletedAssessment || data.latestAssessment);

          const updatedUser: UserCareerProfile = {
            name: data.user.name || 'Rahul Sharma',
            email: data.user.email || 'student@easecareer.com',
            field: (profile.field as CareerField) || 'Software Development',
            company: (profile.company as TargetCompany) || 'Google',
            role: profile.role || 'Software Development Engineer I',
            experienceLevel: (profile.experienceLevel as ExperienceLevel) || 'Intermediate',
            xp: stats.xp ?? 450,
            streak: stats.streak ?? 5,
            level: stats.level ?? 2,
            badges: stats.badges && stats.badges.length > 0
              ? stats.badges
              : ['Orientation Pioneer', 'Assessment Verified', '3-Day Streak'],
            assessmentCompleted: hasAssessment,
            assessmentScore: data.latestAssessment || undefined,
          };

          setUser(updatedUser);

          const updatedRoadmap = generateTailoredRoadmap(
            updatedUser.field,
            updatedUser.company,
            updatedUser.role,
            data.latestAssessment?.demonstratedSkills || ['Two-Pointer Technique', 'Algorithmic Complexity & Big-O'],
            data.latestAssessment?.improvementSkills || ['Distributed Caching & Concurrency', 'SOLID Principles']
          );
          setRoadmapSkills(updatedRoadmap);

          // Route to appropriate step based on profile state
          if (data.profile) {
            setAppStep('dashboard');
          } else {
            setAppStep('onboarding');
          }
        }
      })
      .catch((err) => {
        console.warn('[App] Session expired or invalid, returning to login:', err);
        api.clearToken();
        setAppStep('login');
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, []);

  // 1. Lamp Login completion -> Full auth payload handling
  const handleAuthSuccess = (data: any) => {
    if (!data) return;
    const profile = data.profile;
    const stats = data.stats;
    const u = data.user;

    const updatedUser: UserCareerProfile = {
      name: u?.name || user.name,
      email: u?.email || user.email,
      field: (profile?.field as CareerField) || user.field,
      company: (profile?.company as TargetCompany) || user.company,
      role: profile?.role || user.role,
      experienceLevel: (profile?.experienceLevel as ExperienceLevel) || user.experienceLevel,
      xp: stats?.xp ?? user.xp,
      streak: stats?.streak ?? user.streak,
      level: stats?.level ?? user.level,
      badges: stats?.badges?.length ? stats.badges : user.badges,
      assessmentCompleted: Boolean(data.hasCompletedAssessment || data.latestAssessment),
      assessmentScore: data.latestAssessment || undefined,
    };

    setUser(updatedUser);

    if (profile) {
      const tailored = generateTailoredRoadmap(
        updatedUser.field,
        updatedUser.company,
        updatedUser.role,
        ['Two-Pointer Technique', 'Algorithmic Complexity & Big-O'],
        ['Distributed Caching & Concurrency', 'SOLID Principles']
      );
      setRoadmapSkills(tailored);

      // If user hasn't finished diagnostic assessment, take them to assessment; otherwise dashboard
      if (updatedUser.assessmentCompleted || (stats?.xp && stats.xp > 200)) {
        setAppStep('dashboard');
      } else {
        setAppStep('assessment');
      }
    } else {
      setAppStep('onboarding');
    }
  };

  const handleLoginSuccess = (email: string, name: string) => {
    setUser((prev) => ({
      ...prev,
      email,
      name,
    }));
    // Fallback if full payload not supplied
    setAppStep((prevStep) => (prevStep === 'login' ? 'onboarding' : prevStep));
  };

  // 2. Onboarding completion -> Role Assessment
  const handleOnboardingComplete = (data: {
    field: CareerField;
    company: TargetCompany;
    role: string;
    experienceLevel: ExperienceLevel;
  }) => {
    setUser((prev) => ({
      ...prev,
      field: data.field,
      company: data.company,
      role: data.role,
      experienceLevel: data.experienceLevel,
    }));
    setAppStep('assessment');
  };

  // 3. Assessment completion -> Skill-Gap Roadmap Reveal
  const handleAssessmentComplete = (scoreData: {
    correct: number;
    total: number;
    percentage: number;
    demonstratedSkills: string[];
    improvementSkills: string[];
  }) => {
    const updatedSkills = generateTailoredRoadmap(
      user.field,
      user.company,
      user.role,
      scoreData.demonstratedSkills,
      scoreData.improvementSkills
    );

    setRoadmapSkills(updatedSkills);

    setUser((prev) => ({
      ...prev,
      assessmentCompleted: true,
      assessmentScore: scoreData,
      xp: prev.xp + scoreData.correct * 40,
    }));

    setAppStep('roadmap_reveal');
  };

  // Add XP from Arena / Interview practice
  const handleAddXp = (amount: number, badgeAwarded?: string) => {
    setUser((prev) => {
      const newXp = prev.xp + amount;
      const newLevel = Math.floor(newXp / 350) + 1;
      const updatedBadges = [...prev.badges];
      if (badgeAwarded && !updatedBadges.includes(badgeAwarded)) {
        updatedBadges.push(badgeAwarded);
      }
      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        badges: updatedBadges,
      };
    });
  };

  // Toggle skill completion in roadmap
  const handleSkillToggle = (skillId: string, completed: boolean) => {
    setRoadmapSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, completed, progress: completed ? 100 : 35 } : s))
    );
    if (completed) {
      handleAddXp(100, 'Milestone Mastered');
    }
  };

  const handleLogout = () => {
    api.clearToken();
    setAppStep('login');
    setCurrentTab('dashboard');
  };

  const handleNavigate = (tab: string) => {
    if (tab === 'assessment') {
      setAppStep('assessment');
    } else if (tab === 'onboarding') {
      setAppStep('onboarding');
    } else {
      setAppStep('dashboard');
      setCurrentTab(tab);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#070b16] text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-600 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-cyan-500/20 animate-pulse">
            <span className="text-white text-sm font-extrabold">EC</span>
          </div>
          <div className="text-xs text-slate-400 font-medium tracking-wide">
            Restoring authenticated Ease Career session...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b16] text-slate-100 flex flex-col font-sans">
      {/* 1. First Screen: Lamp Login */}
      {appStep === 'login' && (
        <LampLogin
          onLoginSuccess={handleLoginSuccess}
          onAuthSuccess={handleAuthSuccess}
        />
      )}

      {/* 2. Onboarding Flow */}
      {appStep === 'onboarding' && (
        <OnboardingFlow
          userName={user.name}
          onComplete={handleOnboardingComplete}
          onLogout={handleLogout}
        />
      )}

      {/* 3. Role-Specific Assessment */}
      {appStep === 'assessment' && (
        <RoleAssessment
          field={user.field}
          company={user.company}
          role={user.role}
          onCompleteAssessment={handleAssessmentComplete}
          onBackToOnboarding={() => setAppStep('onboarding')}
          onGoToDashboard={() => setAppStep('dashboard')}
        />
      )}

      {/* 4. Initial Roadmap Reveal after Assessment */}
      {appStep === 'roadmap_reveal' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <SkillGapRoadmap
            field={user.field}
            company={user.company}
            role={user.role}
            skills={roadmapSkills}
            assessmentScore={user.assessmentScore}
            onProceedToDashboard={() => {
              setAppStep('dashboard');
              setCurrentTab('dashboard');
            }}
            onSkillToggle={handleSkillToggle}
            onJumpToArena={() => {
              setAppStep('dashboard');
              setCurrentTab('arena');
            }}
          />
        </div>
      )}

      {/* 5. Main Dashboard Experience (with top navbar and tab switcher) */}
      {appStep === 'dashboard' && (
        <>
          <AppNavbar
            currentTab={currentTab}
            onSelectTab={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            user={user}
            onRetakeOnboarding={() => setAppStep('onboarding')}
            onLogout={handleLogout}
            onOpenAssessment={() => setAppStep('assessment')}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            {currentTab === 'dashboard' && (
              <MainDashboard
                user={user}
                skills={roadmapSkills}
                onNavigate={handleNavigate}
              />
            )}

            {currentTab === 'roadmap' && (
              <SkillGapRoadmap
                field={user.field}
                company={user.company}
                role={user.role}
                skills={roadmapSkills}
                assessmentScore={user.assessmentScore}
                onProceedToDashboard={() => setCurrentTab('dashboard')}
                onSkillToggle={handleSkillToggle}
                onJumpToArena={() => setCurrentTab('arena')}
              />
            )}

            {currentTab === 'arena' && <DebugArena onAddXp={handleAddXp} />}

            {currentTab === 'interview' && (
              <InterviewPractice
                userCompany={user.company}
                userRole={user.role}
                onAddXp={handleAddXp}
              />
            )}

            {currentTab === 'coach' && <AiCareerCoach user={user} />}

            {currentTab === 'analytics' && (
              <ProgressAnalytics user={user} skills={roadmapSkills} />
            )}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-900 bg-[#06070a] py-6 text-center text-xs text-slate-500 mt-12">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="text-slate-400">
                Ease Career • Cinematic Lamp Orientation to Placement Mastery
              </span>
              <span className="text-slate-500">
                Calibrated for {user.company} ({user.role})
              </span>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
