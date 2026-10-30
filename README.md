# Campus Fix – Smart Campus Fault Detection & Maintenance Management System

A modern, responsive, and secure full-stack web application designed for colleges and universities to identify, report, track, assign, and resolve campus maintenance problems with complete transparency and intelligence.

---

## 🌟 Key Features

### 1. Role-Based Portals & Dashboards
- **Student / Faculty Portal:**
  - Fast fault reporting with category, building, floor, room number, description, priority, and photo uploads.
  - Real-time duplicate fault warnings (warns users if an issue was already reported in that classroom).
  - Searchable complaint directory with visual status progress timeline.
  - Ability to reopen complaints if problems persist after resolution.
  - In-app notification center for status change alerts.
- **Maintenance Staff Portal:**
  - Personalized work order queue with urgent/overdue badges.
  - Action buttons to start, update, and complete tasks.
  - Add repair notes and flag administrative assistance if replacement parts/budget are needed.
- **Administrator Control Center:**
  - High-level KPIs: Total faults, open tickets, critical hazards, in-progress, resolved, overdue count, and average turnaround time.
  - **Live Chart.js Visualizations:**
    - Complaint trends over time (reported vs. resolved line chart).
    - Faults by category (doughnut chart).
    - Faults by campus building (bar chart).
    - Technician workload and resolution performance (bar chart).
  - Advanced ticket management: filter, search, adjust priority, assign technician, set deadlines.
  - Intelligent maintenance: automatic overdue task detection & recurring problem spot warnings.
  - Filtered reports and one-click **CSV data export**.
  - Maintenance staff account registration and management.

---

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+), [Lucide Icons](https://lucide.dev/), [Chart.js](https://www.chartjs.org/).
- **Backend:** Node.js, Express.js.
- **Database:** SQLite (`better-sqlite3` with WAL mode and foreign key constraints).
- **Authentication:** JWT (JSON Web Tokens), bcrypt password hashing, and role-based middleware.
- **File Uploads:** Multer with file type validation (JPG, PNG, WEBP) and 5MB size limit.

---

## 📁 Project Folder Structure

```
campus-fix/
│
├── frontend/
│   ├── index.html               # Public landing page with live DB statistics
│   ├── features.html            # Dedicated platform features & capabilities page
│   ├── how-it-works.html        # Dedicated 6-stage lifecycle & workflow guide page
│   ├── live-stats.html          # Dedicated live analytics & SLA performance page
│   ├── login.html               # Sign in page with 1-click test credentials
│   ├── register.html            # Student & Faculty registration page
│   ├── dashboard.html           # Student/Faculty personal dashboard
│   ├── report-fault.html        # Detailed fault complaint form
│   ├── track-complaints.html    # Searchable complaints & visual status timeline
│   ├── staff-dashboard.html     # Maintenance technician work orders
│   ├── admin-dashboard.html     # Administrative control center & Chart.js analytics
│   ├── notifications.html       # In-app notifications center
│   ├── css/
│   │   ├── style.css            # Base stylesheet, theme variables, landing & auth styling
│   │   └── dashboard.css        # Dashboard layouts, sidebar, tables, badges, modals
│   └── js/
│       ├── api.js               # API helper, JWT interceptor, toast notification manager
│       ├── auth.js              # Session control, route guards, profile rendering
│       ├── dashboard.js         # Student dashboard data loader
│       ├── report-fault.js      # Form validation, image preview, duplicate detection
│       ├── track-complaints.js  # Complaint directory, filter listeners, visual timeline
│       ├── staff.js             # Work order actions, repair notes modal
│       ├── admin.js             # Charts rendering, staff assignment, CSV export
│       └── notifications.js     # Notifications loader and mark-as-read logic
│
├── backend/
│   ├── server.js                # Express main server entry point & static hosting
│   ├── database.js              # SQLite schema creation, indexes, and database seeder
│   ├── package.json             # Backend dependencies and run scripts
│   ├── .env                     # Local environment settings
│   ├── .env.example             # Configuration template
│   ├── test_suite.js            # Automated system verification suite
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT verification & user session validation
│   │   └── roleMiddleware.js    # Role-based route guard
│   ├── controllers/
│   │   ├── authController.js    # Register, login, getMe, staff management
│   │   ├── faultController.js   # Fault reporting, filtering, status, history audit
│   │   ├── dashboardController.js # Aggregated metrics for User, Staff, Admin
│   │   └── analyticsController.js # Chart feeds, public stats, CSV export
│   ├── routes/
│   │   ├── authRoutes.js        # /api/auth
│   │   ├── faultRoutes.js       # /api/faults
│   │   ├── dashboardRoutes.js   # /api/dashboard
│   │   ├── notificationRoutes.js# /api/notifications
│   │   └── analyticsRoutes.js   # /api/analytics
│   ├── services/
│   │   └── notificationService.js # In-app notification dispatcher
│   ├── data/
│   │   └── campus_fix.db        # SQLite database file (auto-generated)
│   └── uploads/                 # Uploaded complaint photos directory
│
├── package.json                 # Root package script helper
└── README.md                    # Complete documentation
```

---

## 🚀 Installation & Execution Guide

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended, tested on v24.15.0).
- **Visual Studio Code** and Windows PowerShell or Command Prompt.

### Step 1: Open the Project
Open Visual Studio Code, click **File > Open Folder**, and select:
```
c:\Users\sriva\OneDrive\Desktop\os_cbp\campus-fix
```

### Step 2: Install Backend Dependencies
Open the VS Code Terminal (`Ctrl + ~`) and execute:
```powershell
cd backend
npm install
```

### Step 3: Initialize the Database (Auto-Seeded)
The SQLite database schema and seed data initialize automatically when the server runs. If you ever want to re-seed fresh demo data:
```powershell
npm run seed
```

### Step 4: Start the Server
From the `backend` directory, run:
```powershell
npm start
```
You will see:
```
=======================================================
🚀 Campus Fix Server successfully started!
🌐 Application URL: http://localhost:3000
📡 REST API Base:   http://localhost:3000/api
=======================================================
```

### Step 5: Open the Application
Open your web browser and navigate to:
```
http://localhost:3000
```

---

## 🔑 Demo & Test Accounts

For demonstration and testing convenience, the login page features **1-click quick fill buttons** for each role:

| Role | Email | Password | Description |
|---|---|---|---|
| **Administrator** | `admin@campusfix.edu` | `Admin@123` | Full administrative controls, staff dispatch, analytics, CSV export |
| **Maintenance Staff 1** | `staff.mike@campusfix.edu` | `Staff@123` | Electrician & IT Technician |
| **Maintenance Staff 2** | `staff.sarah@campusfix.edu` | `Staff@123` | Plumber & Facilities Specialist |
| **Faculty Member** | `prof.pratyusha@vnrvjiet.in` | `Faculty@123` | Prof. Pratyusha (University Professor / Instructor) |
| **Student** | `student.alex@campusfix.edu` | `Student@123` | Alex Morgan (Student Reporter) |

---

## 🧪 Testing Every Major Feature

### 1. Test Fault Reporting
1. Sign in as `student.alex@campusfix.edu`.
2. Click **Report New Fault**.
3. Select **Science Complex**, Floor **2nd Floor**, Room **Restroom 2B**, Category **Washroom**.
4. Notice the **Intelligent Duplicate Warning banner** immediately indicating an existing open complaint in that exact room!
5. Change to Room **Room 401**, Category **Electrical**, and submit.
6. A confirmation modal will display your new tracking code (e.g., `CF-2026-XXXX`).

### 2. Test Staff Assignment & Status Tracking
1. Log in as `admin@campusfix.edu`.
2. Navigate to **All Complaints** tab.
3. Click **Assign** on any newly reported complaint.
4. Select `Mike Johnson`, choose priority and target completion deadline, then save.
5. Notice the complaint status changes to `Assigned` and audit logs are recorded.

### 3. Test Technician Work Orders
1. Log in as `staff.mike@campusfix.edu`.
2. View your **Maintenance Work Orders** dashboard.
3. Click **Start** to transition the task to `In Progress`.
4. Click **Update**, enter your repair notes (e.g. *"Replaced faulty ballast capacitor"*), and mark as `Resolved`.

### 4. Test Reopening a Complaint
1. Log back in as the student reporter.
2. Go to **Track Complaints**, click **View** on the resolved complaint.
3. Observe the full interactive visual progress timeline (`Reported → Verified → Assigned → In Progress → Resolved`).
4. Click **Reopen Complaint**, enter a reason, and submit.
5. The complaint status transitions to `Reopened` and an urgent alert is dispatched to admins.

### 5. Test Reports & Analytics CSV Export
1. In the Administrator portal, visit **Reports & CSV Export**.
2. Filter by date or category, or click **Export CSV** in the top bar.
3. A complete CSV spreadsheet (`campus_fix_complaints_report.csv`) will download with complete audit dates, locations, and technician notes.

---

## 🤖 Running the Automated Test Suite

To run all 20 end-to-end integration tests automatically:
```powershell
cd backend
node test_suite.js
```
Expected output:
```
========================================================
TEST RESULTS: 20 PASSED, 0 FAILED
========================================================
```

---

## 🛡️ Security & Best Practices Implemented

- **Password Hashing:** Passwords securely hashed with `bcryptjs` (salt rounds: 10).
- **SQL Injection Prevention:** 100% parameterized SQLite statements via `better-sqlite3`.
- **Role Isolation:** Enforced on backend REST routes using JWT verification and role middlewares (`requireRole`).
- **File Upload Safeguards:** Whitelisted image formats (JPG, JPEG, PNG, WEBP), 5MB size limit, and randomized server-generated file names.
- **Audit Trails:** Every status transition, assignment, and repair note is immutably logged in `fault_history`.
