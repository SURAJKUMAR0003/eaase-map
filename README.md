# Ease Career — Complete Career Preparation Platform

> Career readiness platform built with **React**, **TypeScript**, **Tailwind CSS**, **Node.js/Express**, and a local JSON file database.

---

## 🚀 1. Overview & Vision

**Ease Career** is a comprehensive career preparation platform designed to help students and software engineers prepare for their dream tech companies (Google, NVIDIA, Amazon, Microsoft, Meta, Apple, TCS, and more).

Unlike static prototypes or mockups, Ease Career is a **fully functional, data-persistent application** where users:
1. Create real accounts and authenticate through a cinematic **Lamp Login**.
2. Configure their **target company, role, career track, and experience level**.
3. Take a **real scored diagnostic assessment** with immediate skill-gap analysis.
4. Navigate a **personalized, dependency-based Exploration Graph roadmap**.
5. Solve coding challenges in the **Debug Arena** when a dedicated isolated code runner is configured.
6. Practice in the **AI Mock Interview Studio** with **30+ curated questions** and **real-time, side-by-side answer correctness analysis** (rubric scoring, STAR evaluation, and concept coverage).
7. Track their full learning history on the **Career Dashboard** via the persistent local activity ledger.

---

## 🛠️ 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EASE CAREER FRONTEND                            │
│  React 18 • TypeScript • Tailwind CSS • Vite • React Flow • Monaco     │
├────────────────────────────────────────────────────────────────────────┤
│  • Lamp Login & Auth Flow                                              │
│  • Step-by-Step Career Onboarding (Company / Role / Experience)        │
│  • Role Diagnostic Assessment & Anti-Cheat Scoring                     │
│  • Dual-Mode Roadmap (Exploration Mindmap & React Flow Dependency Flow)│
│  • Debug Arena (Monaco Editor + configured sandbox runner + Auto-Next)│
│  • AI Interview Studio (30+ Questions + Side-by-Side Rubric Grader)    │
│  • Career Dashboard & Persistent Activity Stream                       │
│  • Progress Analytics & 5-Axis Competency Spider Radar                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST API (JWT Authenticated)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       EXPRESS / NODE.JS BACKEND                        │
│  Dedicated Sandbox Runner Client • JWT Authentication • Gemini AI Proxy│
├────────────────────────────────────────────────────────────────────────┤
│  • /api/auth/*              (Register, Login, Me, Forgot/Reset Password)│
│  • /api/onboarding          (Target Career Calibration)                │
│  • /api/assessment/*        (Dynamic Questions & Server Scoring)       │
│  • /api/roadmap/*           (Skill Dependency Graph & Checkpoint Sync) │
│  • /api/challenges/*        (Isolated VM Runner & Gemini Rival Replay) │
│  • /api/interview/*         (30+ Questions & Side-by-Side Answer Grader│
│  • /api/user/activities     (Persistent Activity Ledger)               │
│  • /api/coach/chat          (Server-side Gemini AI Career Coach)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    PERSISTENT STORAGE & AI ENGINES                     │
├────────────────────────────────────────────────────────────────────────┤
│  • Local Persistent JSON Database (data/easecareer.db.json)            │
│    Atomic file replacement • Single-process deployment                 │
│  • Google Gemini 3.8 Flash SDK (@google/genai)                         │
│    Server-side AI evaluation with deterministic offline fallbacks      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 3. Modules & Features Implemented

### 🌟 3.1. Lamp-Themed Authentication & Accounts
- **Cinematic Visuals**: Deep obsidian background with an interactive desk lamp emitting a warm golden glow, animated floating fireflies, and frosted glass translucent forms.
- **Interactive Lighting Toggle**: Clickable cord switch to toggle warm ambient light without interfering with form usability.
- **Secure Persistence**: Real email/password registration, password hashing, JWT sessions, and configured password recovery delivery.
- **Account Verification**: Automatically verifies accounts and preserves state across sessions.

### 🎯 3.2. Step-by-Step Career Onboarding
- **Step 1 — Career Field**: Software Development, AI & Machine Learning, Data Science, Embedded Systems & Firmware, GPU & Systems Programming, Cloud Computing, Frontend, Backend, UI/UX Design, Product Management.
- **Step 2 — Target Company**: Google, NVIDIA, Amazon, Microsoft, Meta, Apple, TCS, Adobe, Netflix, Uber, Stripe, etc.
- **Step 3 — Target Role**: SDE I, Embedded Firmware Engineer, ML Scientist, Systems Programmer, etc.
- **Step 4 — Experience Level & Weekly Commitment**: Beginner, Intermediate, Advanced with custom study hours per day.

### 📝 3.3. Real Diagnostic Assessment & Scoring Engine
- **Targeted Question Bank**: Dynamically selects assessment MCQs tailored to the chosen company and role.
- **Server-Side Anti-Cheat Scoring**: Answers are evaluated securely on the backend; correct options are never sent to the client beforehand.
- **Evidence-Based Diagnostics**: Categorizes demonstrated strengths and improvement gaps based strictly on real responses.

### 🗺️ 3.4. Dual-View Exploration Graph & Dependency Roadmap
- **View 1 — Exploration Mindmap Graph**: Inspired by professional skill maps with glowing Bezier branches, interconnected tracks (Software Engineering, AI Specialist, Systems & Architecture), and interactive node details.
- **View 2 — React Flow Dependency Flow**: Strict prerequisite-enforced learning graph. Downstream nodes remain locked until prerequisite milestones are mastered.
- **Verified Checkpoints**: Users verify skills by completing tasks; progress is saved in the local database.

### ⚔️ 3.5. Debug Arena (Live Code Sandbox & Auto-Next Progression)
- **Multi-Challenge Suite**:
  1. *Valid Palindrome with Alphanumeric Filtering* (Strings & Two-Pointers)
  2. *Two Sum Target Lookup* (Hash Maps & Arrays)
  3. *Maximum Subarray* (Kadane’s Algorithm / Dynamic Programming)
  4. *Valid Parentheses String Matching* (Stacks & Parsing)
  5. *Search in Rotated Sorted Array* (Binary Search)
  6. *Merge Overlapping Intervals* (Intervals & Sorting)
  7. *Reverse Singly Linked Sequence* (Pointers & Linked Lists)
- **Monaco Code Editor**: VS Code-grade in-browser editor with syntax highlighting, line numbers, and language toggles (JavaScript / Python).
- **Dedicated isolated runner**: Code execution stays unavailable until `CODE_RUNNER_URL` points to a properly isolated sandbox service.
- **Gemini Rival Replay**: Competes against Gemini in time-pressured duels, comparing user solution complexity with AI optimal code.
- **Automatic Question Progression**:
  - When all tests pass, a celebratory **+120 XP Awarded** banner appears.
  - A countdown automatically loads the next coding challenge in 5 seconds.
  - Prominent **Next Challenge →** button allows instant advancement.

### 🎙️ 3.6. AI Mock Interview Studio (Clean English & Side-by-Side Analysis)
- **Zero Mixed Language**: Clean, professional English terminology across all tabs, buttons, tips, and rubrics.
- **35+ Curated Interview Questions**: Spanning Google Spanner external consistency, Amazon Leadership Principles (STAR method), NVIDIA Warp Divergence & CUDA bank conflicts, Microsoft Windows thread synchronization, Meta React 18 Fiber Reconciler, AI/ML Scaled Dot-Product Attention, and production P0 outages.
- **Side-by-Side Real-Time Evaluation**:
  - **Left Side**: Question card with company tags, core concepts hint, and candidate response writing area (with speech/voice input simulation and sample answer loader).
  - **Right Side**: Immediate analysis station that answers: **"Is the answer correct?"**
    - **Verdict Badge**: *STRONG PASS (≥85%)*, *GOOD ANSWER (70-84%)*, *NEEDS REVISION (45-69%)*, or *INCOMPLETE (<45%)*.
    - **4-Bar Dimension Breakdown**: Technical Accuracy (0-100%), Structure & Communication (0-100%), Depth & Trade-offs (0-100%), Edge Cases & Scalability (0-100%).
    - **Concepts Covered vs Missed Checklist**: Green checkmarks for covered concepts, amber warnings for missed concepts.
    - **Strengths & Improvements**: Bulleted feedback on what was done well and what needs expansion.
    - **Exemplar Response**: Model solution illustrating how a Senior/Staff Engineer at Google or NVIDIA would answer.
    - **Persistent XP**: Automatically saves practice record to the local database and awards **+75 XP**.
    - **Next Question Button**: Allows seamless one-click practice of the next question.

### 📊 3.7. Career Dashboard & Persistent Activity Stream
- **Target Company & Role Overview**: Shows calibration details and honest readiness index.
- **Recommended Next Milestone**: Directly points to the next highest-priority skill.
- **Live Activity Feed (Saved in the local database)**:
  - Real-time ledger recording every diagnostic assessment, solved debug challenge, evaluated interview answer, and completed milestone.
  - Displays activity type icon, title, score percentage, XP earned (+120 XP, +75 XP), and timestamps.

### 📈 3.8. Progress Analytics & Competency Radar
- **5-Axis Competence Spider Radar**: Visualizes Problem Solving, Technical Knowledge, System Design, Communication, and Leadership.
- **Persistent Assessment History Log**: Records scores, dates, and certification statuses from previous attempts.
- **Achievement Badges Showcase**: Unlocks badges such as *Orientation Pioneer*, *Assessment Verified*, *Bug Hunter Elite*, and *Interview Master*.

### 🤖 3.9. AI Career Coach (Server-Side Gemini API Proxy)
- **Model**: `gemini-3.8-flash` via `@google/genai` TypeScript SDK.
- **Personalized Context**: Injects user’s name, target company, role, experience level, and XP into prompt instructions.
- **Graceful Fallback**: If `GEMINI_API_KEY` is not supplied, the system provides high-fidelity deterministic domain guidance without breaking or throwing runtime errors.

---

## 🗄️ 4. Data Persistence & Database Design

### Local JSON file persistence
The current implementation uses a **local JSON file database** (`data/easecareer.db.json`):
- **Zero External Dependencies**: Automatically initializes when no database file exists.
- **Atomic File Replacement**: Writes a unique temporary file and renames it into place. Run one application process against a given data directory; this storage is not a multi-instance database.
- **Full Schema Persistence**:
  - `users`: User credentials, password hashes, and hashed password reset tokens.
  - `profiles`: Target company, role, track, study hours, timeline.
  - `assessments`: Diagnostic test attempts, scores, demonstrated and improvement skills.
  - `roadmaps`: Skill status (locked, available, completed), progress, and prerequisites.
  - `submissions`: Code submissions, execution times, passed test cases.
  - `practiceRecords`: Interview questions practiced with candidate scores.
  - `activities`: Timestamped stream of all preparation events, XP rewards, and challenge completions.
  - `userStats`: XP, level, daily streaks, unlocked achievement badges.

---

## 🚦 5. API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user account with hashed password |
| `POST` | `/api/auth/login` | Authenticate user and issue JWT bearer token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile, stats, and recent activities |
| `POST` | `/api/onboarding` | Save target company, role, and study preferences |
| `GET` | `/api/assessment/questions` | Retrieve tailored assessment questions for company/role |
| `POST` | `/api/assessment/submit` | Score assessment on backend, log activity, and build roadmap |
| `GET` | `/api/roadmap` | Retrieve user’s personalized skill graph |
| `POST` | `/api/roadmap/skill/:id/checkpoint` | Verify skill completion and unlock downstream prerequisites |
| `GET` | `/api/challenges` | Retrieve all 7 coding challenges |
| `POST` | `/api/challenges/:id/run` | Send code to the configured isolated runner against visible tests |
| `POST` | `/api/challenges/:id/submit` | Submit code against all tests, duel Gemini, and award +120 XP |
| `GET` | `/api/interviews` | Retrieve 30+ curated interview questions with filter/search |
| `POST` | `/api/interview/evaluate-answer` | **Side-by-side answer correctness analysis**, scoring, and +75 XP |
| `GET` | `/api/user/activities` | Fetch persistent user activity stream |
| `POST` | `/api/coach/chat` | Chat with AI Career Coach (Gemini 3.8 Flash proxy) |

---

## 💻 6. Running the Application Locally

### Prerequisites
- Node.js (v18 or higher)
- npm or bun

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Variables
Copy `.env.example` to `.env`. A development JWT secret is generated per process if `JWT_SECRET` is absent; set a stable, random value for production. Production startup fails if the key is missing or shorter than 32 characters.
```env
PORT=3000
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here
```
Password reset requires `PASSWORD_RESET_DELIVERY_URL` and `PASSWORD_RESET_DELIVERY_TOKEN` for an HTTPS delivery endpoint accepting `{ to, subject, text }`. Without delivery configured, reset requests fail safely and no token is issued.

Code execution is disabled unless `CODE_RUNNER_URL` and `CODE_RUNNER_TOKEN` point to a dedicated runner that enforces network isolation, non-root execution, filesystem restrictions, CPU/memory/process limits, execution deadlines, and process cleanup. The runner accepts `{ code, language, entryFunctionName, testCases, timeoutMs }` and returns a structured result. Do not expose a general-purpose execution service through this setting.

### Step 3: Run the Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000` with the Express API and Vite frontend running simultaneously on the same port.

### Step 4: Build for Production
```bash
npm run build
npm start
```

---

## ✅ 7. Verification Checklist

- [x] **Lamp Login**: Cinematic desk lamp with responsive warm light toggle, animated fireflies, and password show/hide.
- [x] **Local persistence**: Stored in a JSON file at `data/easecareer.db.json`.
- [x] **Clean English Interview Studio**: Removed all Portuguese text; professional English technical copy throughout.
- [x] **Side-by-Side Interview Analysis**: Candidate writes answer on the left; right panel analyzes correctness, score (0-100), STAR breakdown, and covered/missed concepts.
- [x] **30+ Curated Interview Questions**: Covers DSA, Distributed Systems, React/Frontend, Backend & DBs, OS/C++, AI/ML, and Behavioral.
- [x] **Debug Arena Auto-Progression**: Automatically loads the next coding challenge upon completion, with instant Next Challenge button.
- [x] **Live Activity Dashboard**: Every assessment, challenge, and interview is saved into the user's persistent activity ledger and rendered on the Career Dashboard.
- [x] **Zero Linter/Build Errors**: Fully verified TypeScript compilation on Vite & Express.
