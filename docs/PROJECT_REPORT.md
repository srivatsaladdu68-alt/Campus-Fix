# Campus Fix – Comprehensive Project Documentation & Viva Guide

## 1. Executive Summary & Abstract
**Campus Fix** is an automated, responsive web application engineered to replace inefficient paper registers, verbal complaints, and delayed email reports across university campuses. It establishes a centralized maintenance pipeline linking students, faculty, technician staff, and campus administrators.

The system features real-time fault reporting with geo-spatial room tagging, image attachment support, intelligent duplicate complaint detection, automated deadline tracking, role-based technician dispatch, and dynamic Chart.js analytics for administrative oversight.

---

## 2. System Architecture

```mermaid
graph TD
    Client["Frontend Clients (HTML5 / CSS3 / Vanilla JS)"]
    subgraph ClientLayers
        Landing["Landing Page (index.html)"]
        StudentDash["Student/Faculty Portal (dashboard.html)"]
        StaffDash["Technician Work Orders (staff-dashboard.html)"]
        AdminDash["Control Center & Analytics (admin-dashboard.html)"]
    end

    Client --> ClientLayers

    subgraph ExpressBackend["Node.js & Express REST Backend"]
        AuthMiddleware["JWT & Role Guard Middleware"]
        AuthRoute["/api/auth (Login, Register, Staff)"]
        FaultRoute["/api/faults (CRUD, Assign, Status, Reopen)"]
        DashRoute["/api/dashboard (Aggregated KPIs)"]
        NotifRoute["/api/notifications (In-App Alerts)"]
        AnalyticsRoute["/api/analytics (Charts, CSV Export)"]
        IoTRoute["/api/iot (Telemetry Ingestion)"]
    end

    ClientLayers -->|REST HTTP / JSON| ExpressBackend

    subgraph SQLiteDatabase["SQLite Embedded Database (better-sqlite3)"]
        UsersTbl[("users")]
        BuildingsTbl[("buildings")]
        FaultsTbl[("faults")]
        HistoryTbl[("fault_history (Audit Trail)")]
        NotifTbl[("notifications")]
        MaintTbl[("maintenance_records")]
        IoTTbl[("iot_sensor_events")]
    end

    ExpressBackend --> SQLiteDatabase
```

---

## 3. Entity Relationship (ER) Diagram

```mermaid
erDiagram
    users ||--o{ faults : "reports"
    users ||--o{ faults : "assigned_to"
    users ||--o{ fault_history : "changed_by"
    users ||--o{ notifications : "receives"
    users ||--o{ maintenance_records : "performs"
    buildings ||--o{ faults : "located_in"
    faults ||--o{ fault_history : "logs"
    faults ||--o{ notifications : "triggers"
    faults ||--o{ maintenance_records : "documents"
    faults ||--o| iot_sensor_events : "generated_from"

    users {
        int user_id PK
        string full_name
        string email
        string phone
        string password_hash
        string role
        datetime created_at
        int is_active
    }

    buildings {
        int building_id PK
        string building_name
        string building_code
    }

    faults {
        int fault_id PK
        string complaint_code UK
        int reported_by FK
        string title
        string description
        string category
        int building_id FK
        string floor_number
        string room_number
        string image_path
        string priority
        string status
        int assigned_to FK
        datetime deadline
        datetime created_at
        datetime updated_at
        datetime resolved_at
    }

    fault_history {
        int history_id PK
        int fault_id FK
        int changed_by FK
        string old_status
        string new_status
        string notes
        datetime changed_at
    }

    notifications {
        int notification_id PK
        int user_id FK
        int fault_id FK
        string message
        int is_read
        datetime created_at
    }

    maintenance_records {
        int record_id PK
        int fault_id FK
        int staff_id FK
        string repair_notes
        int resources_flagged
        datetime started_at
        datetime completed_at
    }

    iot_sensor_events {
        int event_id PK
        string device_id
        string location
        string event_type
        float measured_value
        float threshold_value
        string alert_status
        int fault_id FK
        datetime created_at
    }
```

---

## 4. Lifecycle & Workflow Progression

```mermaid
stateDiagram-v2
    [*] --> Reported: User Submits Fault
    Reported --> Verified: Admin Reviews & Verifies
    Reported --> Rejected: Invalid / Duplicate / Spam
    Verified --> Assigned: Admin Dispatches Technician
    Assigned --> In_Progress: Technician Starts Repair
    In_Progress --> Resolved: Technician Completes Fix
    Resolved --> Closed: Verification Period Passes
    Resolved --> Reopened: User Flags Unresolved Fault
    Closed --> Reopened: Issue Recurs
    Reopened --> Assigned: Priority Re-dispatch
    Closed --> [*]
    Rejected --> [*]
```

---

## 5. Intelligent Maintenance Features

1. **Real-Time Duplicate Warning Engine:**
   - Evaluates active complaints across matching `(building_id, room_number, category)`.
   - Prevents duplicate work tickets and redundant technician visits.
2. **Automated Urgency Deadlines:**
   - **Critical:** 24-hour turnaround target.
   - **High:** 48-hour turnaround target.
   - **Medium:** 72-hour turnaround target.
   - **Low:** 120-hour turnaround target.
   - Dynamic query calculates `deadline < datetime('now')` and tags tickets as **Overdue** with pulsing red indicators.
3. **Recurring Failure Hotspot Detection:**
   - Aggregates rooms experiencing $\ge 2$ historical complaints in the same facility category.
   - Alerts facilities directors to inspect systemic infrastructure problems.
4. **Future IoT Event Telemetry Interface:**
   - Dedicated REST endpoint `POST /api/iot/events`.
   - Supports automated device logging for power fluctuations, water leaks, and overheating.
   - Automatically generates a critical priority work order if measured values exceed safe thresholds.

---

## 6. Viva Defense & Examination Q&A Guide

### Q1: Why use SQLite instead of MySQL or MongoDB for this system?
> **Answer:** SQLite is an embedded, zero-configuration relational database engine operating in WAL (Write-Ahead Logging) mode. It provides high performance, ACID compliance, and easy portability for demonstration without requiring complex database server daemon setups. It uses native SQL foreign keys and indexes.

### Q2: How does the system handle security and role separation?
> **Answer:** 
> - **Authentication:** Passwords are never stored in plaintext; they are hashed using `bcrypt` with cryptographic salt.
> - **JWT Tokens:** Authenticated requests carry signed JSON Web Tokens containing user ID and role claims.
> - **Authorization Middleware:** `requireRole(['admin'])` and `requireRole(['staff', 'admin'])` protect sensitive endpoints on the server.
> - **SQL Injection Prevention:** 100% of queries use parameterized prepared statements.

### Q3: What is the status workflow for a complaint?
> **Answer:** 
> $$\text{Reported} \to \text{Verified} \to \text{Assigned} \to \text{In Progress} \to \text{Resolved} \to \text{Closed}$$
> Handled with immutable audit entries in `fault_history` whenever state transitions occur.

### Q4: How does the CSV report generation work?
> **Answer:** The `/api/analytics/export` endpoint dynamically constructs a database query based on administrative filters (date range, category, status, priority) and streams an RFC-4180-compliant CSV spreadsheet with headers directly to the browser.
