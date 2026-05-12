# PCOP Implementation Agent Instructions
## Predictive Customer Outreach Platform — Backend & Frontend

> **Scope:** This document covers only the **Bank (Node.js data server)**, **Server (Node.js/Express backend)**, and **Client (React frontend)**. All ML model training, statistical detection algorithms (CUSUM, BOCPD, etc.), and LangGraph orchestration internals are out of scope. Signal results, churn scores, and life events are served as pre-seeded dummy data.

---

## 0. AGENT GROUND RULES

1. **Check before you build.** Before implementing any feature, check whether it already exists:
   - For backend routes: grep the routers directory for the endpoint path.
   - For frontend pages/components: check `src/pages/` and `src/components/` for the file.
   - For database tables: check `infra/postgres/migrations/` for existing DDL, or run `\dt` in psql.
   - For bank API endpoints: check `routes/` in the bank server for the path.
   - If the feature exists and is correct, **skip it**. If it exists but is incomplete, **patch it**.

2. **One concern per file.** Do not put multiple routers, models, or page components in the same file.

3. **Never hardcode credentials.** All connection strings, API keys, and secrets come from environment variables.

4. **Dummy data is truth.** The bank server returns synthetic data. The FastAPI server never calls real bank systems. The frontend never hits the bank server directly — only FastAPI.

5. **TypeScript is mandatory** on the frontend. Do not use `any` types except where explicitly noted.

6. **Verify your work.** After implementing each section, run the relevant test or curl command listed at the end of each section.

---

## 1. REPOSITORY STRUCTURE

Confirm or create the following top-level layout. Do not deviate from this structure.

```
pcop/
├── bank/                    # Node.js dummy bank data server
│   ├── src/
│   │   ├── routes/
│   │   ├── data/            # Seed JSON / in-memory data
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── server/                  # Node.js/Express backend
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── config.js
│   ├── index.js
│   ├── package.json
│   └── .env.example
│
├── client/                  # React + TypeScript frontend
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
│
└── docker-compose.yml
```

---

## 2. BANK SERVER (Node.js + TypeScript)

The bank server is a read-only data source. It exposes raw banking data that the FastAPI server ingests. All data is in-memory from seed files — no real database connection required.

### 2.1 Check existing routes

```bash
# Run this first — list all registered routes
grep -r "router\.\(get\|post\|put\|delete\)" bank/src/routes/
```

### 2.2 Required endpoints

Implement each endpoint only if it does not already exist. All endpoints return JSON arrays unless noted.

#### `GET /customers`
Returns all 20 customer master records.

**Response shape (array of):**
```typescript
{
  customer_id: string;           // "C-00000001"
  full_name: string;
  email: string;
  phone_mobile: string;
  date_of_birth: string;         // ISO date
  gender: string;
  marital_status: string;
  nationality: string;
  address_line1: string;
  city: string;
  state: string;
  pincode: string;
  customer_since: string;        // ISO date
  segment: "HNW" | "Mass Affluent" | "Mass Market" | "Digital Native";
  relationship_manager_id: string;
  preferred_channel: "email" | "sms" | "app" | "call" | "rm_visit";
  email_opt_in: boolean;
  sms_opt_in: boolean;
  push_opt_in: boolean;
  call_opt_in: boolean;
  employer_name: string;
  employment_type: "salaried" | "self_employed" | "retired";
  annual_income_band: "under_5L" | "5L_10L" | "10L_25L" | "above_25L";
  kyc_status: "verified" | "pending" | "flagged";
}
```

#### `GET /customers/:id`
Returns a single customer by `customer_id`. Return 404 if not found.

#### `GET /accounts`
Returns all accounts. Query param: `?customer_id=` to filter.

**Response shape (array of):**
```typescript
{
  account_id: string;
  customer_id: string;
  account_type: "savings" | "current" | "fd" | "loan" | "cc";
  product_code: string;
  balance: number;
  currency: string;            // default "INR"
  opened_date: string;
  status: "active" | "dormant" | "closed";
  branch_code: string;
  interest_rate: number;
  credit_limit: number | null;
}
```

#### `GET /transactions`
Returns transactions. Query params: `?customer_id=`, `?limit=` (default 100), `?offset=0`, `?from_date=`, `?to_date=`.

**Response shape (array of):**
```typescript
{
  txn_id: number;
  customer_id: string;
  account_id: string;
  txn_date: string;
  txn_timestamp: string;
  amount: number;
  direction: "debit" | "credit";
  category: "salary_credit" | "emi" | "transfer" | "retail" | "atm";
  mcc_code: string | null;
  merchant_name: string | null;
  merchant_city: string | null;
  channel: "upi" | "neft" | "card" | "atm" | "branch";
  payment_ref: string | null;
  balance_after: number;
  is_international: boolean;
}
```

#### `GET /crm-notes`
Returns CRM notes. Query param: `?customer_id=`.

**Response shape (array of):**
```typescript
{
  note_id: number;
  customer_id: string;
  note_type: "complaint" | "enquiry" | "feedback" | "visit_note";
  note_text: string;
  sentiment_score: number;     // -1.0 to 1.0
  issue_category: "fee_dispute" | "service" | "product" | "other";
  resolved: boolean;
  resolution_days: number | null;
  agent_id: string;
  channel: "call" | "branch" | "chat" | "email";
  created_at: string;
}
```

#### `GET /app-events`
Returns app events. Query params: `?customer_id=`, `?limit=` (default 200).

**Response shape (array of):**
```typescript
{
  event_id: number;
  customer_id: string;
  event_type: "login" | "logout" | "feature_view" | "transfer" | "investment_tab" | "support_chat" | "notification_tap";
  feature_name: string | null;
  session_id: string;
  session_duration_s: number;
  platform: "android" | "ios" | "web";
  app_version: string;
  event_timestamp: string;
}
```

#### `GET /account-events`
Returns account lifecycle events. Query param: `?customer_id=`.

**Response shape (array of):**
```typescript
{
  event_id: number;
  customer_id: string;
  account_id: string | null;
  event_type: "JOINT_ACCOUNT_OPEN" | "MORTGAGE_ENQUIRY" | "LIFE_INSURANCE_OPEN" | "WILL_SERVICE_ENQUIRY" | "ACCOUNT_CLOSURE_REQUEST" | "PRODUCT_ADD";
  product_code: string | null;
  event_date: string;
  metadata: Record<string, unknown>;
}
```

#### `GET /kyc-updates`
Returns KYC field update history. Query param: `?customer_id=`.

**Response shape (array of):**
```typescript
{
  update_id: number;
  customer_id: string;
  field_name: "employer" | "occupation" | "annual_income" | "address" | "phone" | "email";
  old_value: string;
  new_value: string;
  updated_by: "customer_self" | "branch" | "system";
  verification_status: "pending" | "verified" | "rejected";
  updated_at: string;
}
```

#### `GET /external-enrichment`
Returns external enrichment data. Query param: `?customer_id=`.

**Response shape (array of):**
```typescript
{
  enrichment_id: number;
  customer_id: string;
  source: "linkedin" | "credit_bureau" | "demographics";
  field: string;
  value: string;
  confidence: number;
  captured_at: string;
  expires_at: string | null;
}
```

#### `GET /health`
Returns `{ status: "ok", timestamp: "<ISO>" }`.

### 2.3 Dummy seed data

Create `bank/src/data/seed.ts` containing all in-memory arrays. Implement exactly the 20 customers listed below, plus supporting records for accounts, transactions, CRM notes, and app events.

#### Customers (all 20)

```typescript
export const CUSTOMERS = [
  {
    customer_id: "C-00000001", full_name: "Arjun Sharma", age: 38,
    email: "arjun.sharma@email.com", phone_mobile: "9876500001",
    date_of_birth: "1987-03-14", gender: "Male", marital_status: "Married",
    nationality: "Indian", address_line1: "14 Marine Drive", city: "Mumbai",
    state: "Maharashtra", pincode: "400001", customer_since: "2015-06-10",
    segment: "HNW", relationship_manager_id: "RM-001",
    preferred_channel: "call", email_opt_in: true, sms_opt_in: true,
    push_opt_in: true, call_opt_in: true,
    employer_name: "Infosys Limited", employment_type: "salaried",
    annual_income_band: "above_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000002", full_name: "Priya Nair", age: 29,
    email: "priya.nair@email.com", phone_mobile: "9876500002",
    date_of_birth: "1996-07-22", gender: "Female", marital_status: "Single",
    nationality: "Indian", address_line1: "7 Koramangala 5th Block", city: "Bangalore",
    state: "Karnataka", pincode: "560095", customer_since: "2022-01-15",
    segment: "Digital Native", relationship_manager_id: null,
    preferred_channel: "app", email_opt_in: true, sms_opt_in: false,
    push_opt_in: true, call_opt_in: false,
    employer_name: "Flipkart", employment_type: "salaried",
    annual_income_band: "10L_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000003", full_name: "Ramesh Gupta", age: 54,
    email: "ramesh.gupta@email.com", phone_mobile: "9876500003",
    date_of_birth: "1971-11-03", gender: "Male", marital_status: "Married",
    nationality: "Indian", address_line1: "22 Anna Nagar", city: "Chennai",
    state: "Tamil Nadu", pincode: "600040", customer_since: "2010-03-20",
    segment: "Mass Affluent", relationship_manager_id: "RM-002",
    preferred_channel: "email", email_opt_in: true, sms_opt_in: true,
    push_opt_in: false, call_opt_in: true,
    employer_name: "Self Employed", employment_type: "self_employed",
    annual_income_band: "10L_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000004", full_name: "Deepa Krishnan", age: 42,
    email: "deepa.krishnan@email.com", phone_mobile: "9876500004",
    date_of_birth: "1983-05-19", gender: "Female", marital_status: "Married",
    nationality: "Indian", address_line1: "8 Banjara Hills", city: "Hyderabad",
    state: "Telangana", pincode: "500034", customer_since: "2017-09-05",
    segment: "Mass Affluent", relationship_manager_id: "RM-003",
    preferred_channel: "email", email_opt_in: true, sms_opt_in: true,
    push_opt_in: true, call_opt_in: true,
    employer_name: "TCS", employment_type: "salaried",
    annual_income_band: "10L_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000005", full_name: "Vikram Singh", age: 33,
    email: "vikram.singh@email.com", phone_mobile: "9876500005",
    date_of_birth: "1992-08-30", gender: "Male", marital_status: "Single",
    nationality: "Indian", address_line1: "3 Lajpat Nagar", city: "Delhi",
    state: "Delhi", pincode: "110024", customer_since: "2019-04-11",
    segment: "Mass Market", relationship_manager_id: null,
    preferred_channel: "sms", email_opt_in: false, sms_opt_in: true,
    push_opt_in: true, call_opt_in: true,
    employer_name: "Amazon India", employment_type: "salaried",
    annual_income_band: "5L_10L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000006", full_name: "Meena Agarwal", age: 61,
    email: "meena.agarwal@email.com", phone_mobile: "9876500006",
    date_of_birth: "1964-02-08", gender: "Female", marital_status: "Widowed",
    nationality: "Indian", address_line1: "5 Park Street", city: "Kolkata",
    state: "West Bengal", pincode: "700016", customer_since: "2006-07-12",
    segment: "HNW", relationship_manager_id: "RM-001",
    preferred_channel: "rm_visit", email_opt_in: true, sms_opt_in: true,
    push_opt_in: false, call_opt_in: true,
    employer_name: "Retired", employment_type: "retired",
    annual_income_band: "above_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000007", full_name: "Karthik Rajan", age: 27,
    email: "karthik.rajan@email.com", phone_mobile: "9876500007",
    date_of_birth: "1998-12-01", gender: "Male", marital_status: "Single",
    nationality: "Indian", address_line1: "12 Viman Nagar", city: "Pune",
    state: "Maharashtra", pincode: "411014", customer_since: "2023-02-20",
    segment: "Digital Native", relationship_manager_id: null,
    preferred_channel: "app", email_opt_in: true, sms_opt_in: false,
    push_opt_in: true, call_opt_in: false,
    employer_name: "Zepto", employment_type: "salaried",
    annual_income_band: "5L_10L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000008", full_name: "Sunita Patel", age: 45,
    email: "sunita.patel@email.com", phone_mobile: "9876500008",
    date_of_birth: "1980-06-25", gender: "Female", marital_status: "Married",
    nationality: "Indian", address_line1: "9 Navrangpura", city: "Ahmedabad",
    state: "Gujarat", pincode: "380009", customer_since: "2016-11-30",
    segment: "Mass Market", relationship_manager_id: null,
    preferred_channel: "email", email_opt_in: true, sms_opt_in: true,
    push_opt_in: false, call_opt_in: true,
    employer_name: "Adani Ports", employment_type: "salaried",
    annual_income_band: "5L_10L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000009", full_name: "Anand Mishra", age: 36,
    email: "anand.mishra@email.com", phone_mobile: "9876500009",
    date_of_birth: "1989-04-17", gender: "Male", marital_status: "Married",
    nationality: "Indian", address_line1: "6 Hazratganj", city: "Lucknow",
    state: "Uttar Pradesh", pincode: "226001", customer_since: "2018-08-14",
    segment: "Mass Market", relationship_manager_id: null,
    preferred_channel: "sms", email_opt_in: true, sms_opt_in: true,
    push_opt_in: true, call_opt_in: true,
    employer_name: "BSNL", employment_type: "salaried",
    annual_income_band: "5L_10L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000010", full_name: "Lakshmi Venkat", age: 31,
    email: "lakshmi.venkat@email.com", phone_mobile: "9876500010",
    date_of_birth: "1994-09-09", gender: "Female", marital_status: "Single",
    nationality: "Indian", address_line1: "18 T Nagar", city: "Chennai",
    state: "Tamil Nadu", pincode: "600017", customer_since: "2021-05-03",
    segment: "Digital Native", relationship_manager_id: null,
    preferred_channel: "app", email_opt_in: true, sms_opt_in: false,
    push_opt_in: true, call_opt_in: false,
    employer_name: "Freshworks", employment_type: "salaried",
    annual_income_band: "10L_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000011", full_name: "Suresh Mehta", age: 49,
    email: "suresh.mehta@email.com", phone_mobile: "9876500011",
    date_of_birth: "1976-01-28", gender: "Male", marital_status: "Married",
    nationality: "Indian", address_line1: "4 Ring Road", city: "Surat",
    state: "Gujarat", pincode: "395002", customer_since: "2013-10-07",
    segment: "Mass Affluent", relationship_manager_id: "RM-002",
    preferred_channel: "email", email_opt_in: true, sms_opt_in: true,
    push_opt_in: false, call_opt_in: true,
    employer_name: "Textile Exports Ltd", employment_type: "self_employed",
    annual_income_band: "10L_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000012", full_name: "Pooja Iyer", age: 26,
    email: "pooja.iyer@email.com", phone_mobile: "9876500012",
    date_of_birth: "1999-03-15", gender: "Female", marital_status: "Single",
    nationality: "Indian", address_line1: "21 HSR Layout", city: "Bangalore",
    state: "Karnataka", pincode: "560102", customer_since: "2024-01-10",
    segment: "Digital Native", relationship_manager_id: null,
    preferred_channel: "app", email_opt_in: true, sms_opt_in: true,
    push_opt_in: true, call_opt_in: false,
    employer_name: "Swiggy", employment_type: "salaried",
    annual_income_band: "5L_10L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000013", full_name: "Harish Bansal", age: 58,
    email: "harish.bansal@email.com", phone_mobile: "9876500013",
    date_of_birth: "1967-07-11", gender: "Male", marital_status: "Married",
    nationality: "Indian", address_line1: "2 Civil Lines", city: "Jaipur",
    state: "Rajasthan", pincode: "302006", customer_since: "2008-12-01",
    segment: "Mass Affluent", relationship_manager_id: "RM-003",
    preferred_channel: "call", email_opt_in: true, sms_opt_in: true,
    push_opt_in: false, call_opt_in: true,
    employer_name: "State Bank of India", employment_type: "salaried",
    annual_income_band: "10L_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000014", full_name: "Nisha Reddy", age: 34,
    email: "nisha.reddy@email.com", phone_mobile: "9876500014",
    date_of_birth: "1991-10-20", gender: "Female", marital_status: "Single",
    nationality: "Indian", address_line1: "10 Kondapur", city: "Hyderabad",
    state: "Telangana", pincode: "500084", customer_since: "2021-03-18",
    segment: "Mass Market", relationship_manager_id: null,
    preferred_channel: "sms", email_opt_in: true, sms_opt_in: true,
    push_opt_in: true, call_opt_in: true,
    employer_name: "Wipro", employment_type: "salaried",
    annual_income_band: "5L_10L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000015", full_name: "Gaurav Tiwari", age: 41,
    email: "gaurav.tiwari@email.com", phone_mobile: "9876500015",
    date_of_birth: "1984-02-14", gender: "Male", marital_status: "Married",
    nationality: "Indian", address_line1: "7 Vijay Nagar", city: "Indore",
    state: "Madhya Pradesh", pincode: "452010", customer_since: "2017-06-22",
    segment: "Mass Market", relationship_manager_id: null,
    preferred_channel: "email", email_opt_in: true, sms_opt_in: true,
    push_opt_in: true, call_opt_in: true,
    employer_name: "NTPC", employment_type: "salaried",
    annual_income_band: "5L_10L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000016", full_name: "Anjali Desai", age: 30,
    email: "anjali.desai@email.com", phone_mobile: "9876500016",
    date_of_birth: "1995-08-05", gender: "Female", marital_status: "Single",
    nationality: "Indian", address_line1: "33 Bandra West", city: "Mumbai",
    state: "Maharashtra", pincode: "400050", customer_since: "2022-07-01",
    segment: "Digital Native", relationship_manager_id: null,
    preferred_channel: "app", email_opt_in: true, sms_opt_in: false,
    push_opt_in: true, call_opt_in: false,
    employer_name: "Razorpay", employment_type: "salaried",
    annual_income_band: "10L_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000017", full_name: "Mahesh Kumar", age: 52,
    email: "mahesh.kumar@email.com", phone_mobile: "9876500017",
    date_of_birth: "1973-12-30", gender: "Male", marital_status: "Married",
    nationality: "Indian", address_line1: "11 Dharampeth", city: "Nagpur",
    state: "Maharashtra", pincode: "440010", customer_since: "2011-04-16",
    segment: "Mass Affluent", relationship_manager_id: "RM-002",
    preferred_channel: "email", email_opt_in: true, sms_opt_in: true,
    push_opt_in: false, call_opt_in: true,
    employer_name: "MPCB", employment_type: "salaried",
    annual_income_band: "10L_25L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000018", full_name: "Divya Pillai", age: 28,
    email: "divya.pillai@email.com", phone_mobile: "9876500018",
    date_of_birth: "1997-06-12", gender: "Female", marital_status: "Single",
    nationality: "Indian", address_line1: "5 Marine Drive", city: "Kochi",
    state: "Kerala", pincode: "682011", customer_since: "2023-09-25",
    segment: "Digital Native", relationship_manager_id: null,
    preferred_channel: "app", email_opt_in: true, sms_opt_in: true,
    push_opt_in: true, call_opt_in: false,
    employer_name: "UST Global", employment_type: "salaried",
    annual_income_band: "5L_10L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000019", full_name: "Rajesh Yadav", age: 46,
    email: "rajesh.yadav@email.com", phone_mobile: "9876500019",
    date_of_birth: "1979-01-07", gender: "Male", marital_status: "Married",
    nationality: "Indian", address_line1: "9 Lanka", city: "Varanasi",
    state: "Uttar Pradesh", pincode: "221005", customer_since: "2015-11-18",
    segment: "Mass Market", relationship_manager_id: null,
    preferred_channel: "call", email_opt_in: true, sms_opt_in: true,
    push_opt_in: false, call_opt_in: true,
    employer_name: "Railway Canteen Stores", employment_type: "salaried",
    annual_income_band: "under_5L", kyc_status: "verified"
  },
  {
    customer_id: "C-00000020", full_name: "Smita Joshi", age: 39,
    email: "smita.joshi@email.com", phone_mobile: "9876500020",
    date_of_birth: "1986-04-28", gender: "Female", marital_status: "Single",
    nationality: "Indian", address_line1: "16 Gangapur Road", city: "Nashik",
    state: "Maharashtra", pincode: "422013", customer_since: "2019-02-14",
    segment: "Mass Affluent", relationship_manager_id: "RM-003",
    preferred_channel: "email", email_opt_in: true, sms_opt_in: true,
    push_opt_in: true, call_opt_in: true,
    employer_name: "Nashik Municipal Corp", employment_type: "salaried",
    annual_income_band: "5L_10L", kyc_status: "verified"
  }
];
```

#### Transaction generation rules

Generate at least 500 transactions spread across all customers. For customers with high churn scores, apply these patterns:

| Customer | Churn Score | Transaction Pattern |
|---|---|---|
| C-00000001 | 0.87 | Employer changes from `TATA CONSULTANCY` → `INFOSYS LIMITED` at month 4. Dominant city shifts from Mumbai → Bangalore. |
| C-00000002 | 0.71 | Transaction frequency drops 40% over last 6 weeks. |
| C-00000004 | 0.62 | Monthly overdraft events appear in last 3 months. |
| C-00000006 | 0.91 | MCC 7261 (funeral) transaction in month 5. All regular transactions drop. |
| C-00000008 | 0.44 | Salary credit amount drops from 65,000 → 53,000 (−18%) at month 3. |
| C-00000012 | 0.89 | Employer reference switches mid-period. All engagement drops. |
| C-00000014 | 0.73 | City shifts from Hyderabad → Pune. MCC 6552 (real estate) appears. |
| C-00000020 | 0.47 | MCC 5944 (jewellery) + MCC 7011 (hotel) appear (wedding signals). |

For all customers, generate 6 months of history (180 days back from today). Salary credits arrive on the 1st of each month.

#### CRM Notes generation rules

Generate at least 3 CRM notes per customer. For specific customers:

| Customer | Notes to include |
|---|---|
| C-00000001 | Fee dispute (Aug, unresolved), address update + home loan enquiry (Sept), repeat fee complaint mentioning Kotak Mahindra (Oct, unresolved) |
| C-00000006 | Bereavement note mentioning probate / estate settlement |
| C-00000009 | Two unresolved complaints about service quality |
| C-00000019 | Repayment difficulty mentioned, stress indicators |

Sentiment scores: complaints = −0.3 to −0.8, enquiries = 0.1 to 0.5, feedback = 0.2 to 0.7.

#### App events generation rules

Generate 30 days of app events per customer. For high-risk customers, show decay:
- Weeks 1–2: daily logins, 3–5 feature views per session
- Weeks 3–4: logins drop to every 3–4 days, session_duration_s drops by 50%
- Final 5 days for Critical customers: zero logins

### 2.4 Verification

```bash
curl http://localhost:3001/health
curl http://localhost:3001/customers | jq length            # should be 20
curl http://localhost:3001/customers/C-00000001 | jq .
curl "http://localhost:3001/transactions?customer_id=C-00000001&limit=20" | jq length
curl "http://localhost:3001/crm-notes?customer_id=C-00000001" | jq length  # should be >= 3
```

---

## 3. SERVER (Node.js/Express)

### 3.1 Check existing implementation

```bash
# Check which routers exist
ls server/routes/

# Check which services exist
ls server/services/
```

### 3.2 Environment setup

Verify `.env` contains all of the following. Create from `.env.example` if missing:

```env
PORT=8000
BANK_API_BASE_URL=http://localhost:3001
JWT_SECRET=change-this-in-production
JWT_EXPIRES_IN=8h
```

### 3.3 In-memory data store

The server maintains in-memory stores for churn scores, signals, life events, campaigns, outreach records, and users. This data is pre-seeded and does not require a database.

#### Churn scores (seed one record per customer for today's date)

```javascript
const CHURN_SCORES = [
  { customer_id: "C-00000001", churn_score: 0.87, risk_tier: "critical",
    reason_codes: ["Employer changed to Infosys", "City shifted to Bangalore", "Unresolved fee complaint"] },
  { customer_id: "C-00000002", churn_score: 0.71, risk_tier: "high",
    reason_codes: ["Transaction frequency declining", "App engagement decay"] },
  { customer_id: "C-00000003", churn_score: 0.34, risk_tier: "watch",
    reason_codes: ["Mild transaction frequency decline"] },
  { customer_id: "C-00000004", churn_score: 0.62, risk_tier: "medium",
    reason_codes: ["Complaint sentiment drift", "Overdraft events increasing"] },
  { customer_id: "C-00000005", churn_score: 0.19, risk_tier: "low", reason_codes: [] },
  { customer_id: "C-00000006", churn_score: 0.91, risk_tier: "critical",
    reason_codes: ["BOCPD joint alarm", "Bereavement CRM note", "Transaction volume collapse"] },
  { customer_id: "C-00000007", churn_score: 0.78, risk_tier: "high",
    reason_codes: ["Engagement decay", "Competitor rate change signal"] },
  { customer_id: "C-00000008", churn_score: 0.44, risk_tier: "medium",
    reason_codes: ["Salary credit decreased 18%"] },
  { customer_id: "C-00000009", churn_score: 0.55, risk_tier: "medium",
    reason_codes: ["Complaint sentiment deteriorating", "Transaction frequency decline"] },
  { customer_id: "C-00000010", churn_score: 0.22, risk_tier: "low", reason_codes: [] },
  { customer_id: "C-00000011", churn_score: 0.66, risk_tier: "high",
    reason_codes: ["Digital engagement drop", "Complaint sentiment drift"] },
  { customer_id: "C-00000012", churn_score: 0.89, risk_tier: "critical",
    reason_codes: ["Job change detected", "All engagement signals firing", "Market signal active"] },
  { customer_id: "C-00000013", churn_score: 0.41, risk_tier: "medium",
    reason_codes: ["Mild salary drift", "Retirement signal detected"] },
  { customer_id: "C-00000014", churn_score: 0.73, risk_tier: "high",
    reason_codes: ["Transaction city shifted to Pune", "MCC relocation pattern"] },
  { customer_id: "C-00000015", churn_score: 0.29, risk_tier: "watch",
    reason_codes: ["Mild financial stress MCC signal"] },
  { customer_id: "C-00000016", churn_score: 0.82, risk_tier: "critical",
    reason_codes: ["All engagement signals active", "SPRT complaint count alarm"] },
  { customer_id: "C-00000017", churn_score: 0.38, risk_tier: "watch",
    reason_codes: ["Mild transaction frequency decline"] },
  { customer_id: "C-00000018", churn_score: 0.68, risk_tier: "high",
    reason_codes: ["Engagement decay across all channels"] },
  { customer_id: "C-00000019", churn_score: 0.51, risk_tier: "medium",
    reason_codes: ["Financial stress indicators", "Unresolved complaint"] },
  { customer_id: "C-00000020", churn_score: 0.47, risk_tier: "medium",
    reason_codes: ["Salary drift detected", "Wedding MCC pattern"] },
];
```

Also seed 90 days of historical scores per customer (randomly walk from 0.15 to current score with ±0.03 daily variance).

#### Signal results (seed latest signals per customer)

For each active signal, create signal records. Signal types: `transaction_frequency`, `salary_amount`, `digital_engagement`, `complaint_sentiment`, `stress_overdraft`, `location_city`, `lifecycle_mcc`, `joint_bocpd`.

#### Life events (seed per the dummy data table)

```javascript
const LIFE_EVENTS = [
  { customer_id: "C-00000001", event_type: "job_change", confidence: 0.85,
    evidence: ["Employer ref changed TCS→Infosys", "KYC employer updated"], source: "rule_ml", risk_adjustment: 0.15 },
  { customer_id: "C-00000001", event_type: "relocation", confidence: 0.80,
    evidence: [">60% transactions in Bangalore", "Rental agency payment in Bangalore"], source: "rule_ml", risk_adjustment: 0.10 },
  { customer_id: "C-00000006", event_type: "bereavement", confidence: 0.75,
    evidence: ["CRM note mentions probate", "MCC 7261 transaction", "Transaction volume collapse"], source: "llm_reasoning", risk_adjustment: 0.20 },
  { customer_id: "C-00000008", event_type: "salary_change", confidence: 0.82,
    evidence: ["Salary dropped from 65000 to 53000", "Same employer retained"], source: "rule_ml", risk_adjustment: 0.08 },
  { customer_id: "C-00000012", event_type: "job_change", confidence: 0.79,
    evidence: ["New employer detected in salary ref"], source: "rule_ml", risk_adjustment: 0.12 },
  { customer_id: "C-00000013", event_type: "retirement", confidence: 0.65,
    evidence: ["Age 58", "Mild salary drift", "Enquiry about pension products"], source: "llm_reasoning", risk_adjustment: 0.05 },
  { customer_id: "C-00000014", event_type: "relocation", confidence: 0.88,
    evidence: ["City shifted Hyderabad→Pune", "MCC 6552 real estate payment"], source: "rule_ml", risk_adjustment: 0.10 },
  { customer_id: "C-00000019", event_type: "financial_stress", confidence: 0.72,
    evidence: ["Overdraft events", "Repayment difficulty in CRM"], source: "rule_ml", risk_adjustment: 0.15 },
  { customer_id: "C-00000020", event_type: "marriage", confidence: 0.76,
    evidence: ["MCC 5944 jewellery store", "MCC 7011 hotel booking", "Wedding venue payment"], source: "rule_ml", risk_adjustment: -0.05 },
];
```

#### Campaigns (seed 3 campaigns)

```javascript
const CAMPAIGNS = [
  {
    campaign_id: "CAMP-2025-Q1-RET",
    campaign_name: "Q1 2025 Retention Drive",
    campaign_type: "retention",
    target_segment: null,
    target_risk_tier: "critical,high",
    start_date: "2025-01-01",
    end_date: "2025-03-31",
    status: "completed",
    holdout_pct: 15.0,
    created_by: "admin"
  },
  {
    campaign_id: "CAMP-2025-Q2-LIFE",
    campaign_name: "Q2 Lifecycle Outreach",
    campaign_type: "lifecycle",
    target_segment: "Mass Affluent",
    target_risk_tier: "medium",
    start_date: "2025-04-01",
    end_date: "2025-06-30",
    status: "active",
    holdout_pct: 15.0,
    created_by: "admin"
  },
  {
    campaign_id: "CAMP-2025-Q2-DIG",
    campaign_name: "Digital Native Re-engagement",
    campaign_type: "engagement",
    target_segment: "Digital Native",
    target_risk_tier: "high,critical",
    start_date: "2025-05-01",
    end_date: "2025-06-30",
    status: "active",
    holdout_pct: 15.0,
    created_by: "admin"
  }
];
```

Seed at least 40 outreach records spread across customers and campaigns, with varied statuses (`sent`, `delivered`, `opened`, `clicked`). Seed matching interaction events. Seed uplift results with realistic retention rates.

### 3.4 Express routers

Implement each router only if the file does not already exist or the endpoint is missing.

#### `routes/customers.js`

```
GET  /api/customers
     Query params: tier, segment, city, page (default 1), limit (default 50), search
     → fetches from bank API, enriches with latest churn_score
     → returns paginated list of customers with risk

GET  /api/customers/:id
     → fetches from bank API, enriches with churn score, signals, life events, outreach history
     → returns customer detail object

GET  /api/customers/:id/signals
     → returns signals for this customer

GET  /api/customers/:id/transactions
     → returns transactions for this customer

GET  /api/customers/:id/insights
     → returns engagement, CRM, stress, and location insights
```

#### `routes/portfolio.js`

```
GET  /api/portfolio/stats
     → returns portfolio-level stats

GET  /api/portfolio/risk-distribution
     → returns count per risk tier

GET  /api/portfolio/churn-trend
     → returns weekly churn trend data

GET  /api/portfolio/signal-breakdown
     → returns signal type counts

GET  /api/portfolio/top-at-risk
     → returns top N customers by churn score

GET  /api/portfolio/market-signals
     → returns market-level signals
```

#### `routes/analysis.js`

```
GET  /api/analysis/dashboard
     → returns dashboard aggregates

GET  /api/analysis/warnings
     → returns active alarms sorted by severity
```

#### `routes/outreach.js`

```
GET  /api/outreach
     Query params: customer_id, campaign_id, channel, status, page, limit
     → returns outreach records

POST /api/outreach
     Auth: manager or admin role required
     Body: { customer_id: str, channel: str, message: str }
     → creates outreach record, returns outreach_id

GET  /api/outreach/:id
     → returns outreach detail

GET  /api/campaigns
     → returns all campaigns with stats

GET  /api/analytics/uplift
     → returns uplift results
```

#### `routes/auth.js`

```
POST /auth/login
     Body: { username: str, password: str }
     → returns { token: str, role: str }

Seed these users (passwords stored as plain text for demo):
  analyst  / analyst123   → role: analyst
  manager  / manager123   → role: manager
  admin    / admin123     → role: admin
```

### 3.5 Auth middleware

```javascript
// middleware/auth.js
// Implement JWT verification middleware
// Extract user from token and attach to req.user
// Implement requireRole(roles) middleware factory
// All read endpoints require at minimum analyst role
// POST /outreach requires manager or admin
```

### 3.6 Demo server client

Create `services/demoServerClient.js` that wraps axios calls to the bank server:

```javascript
// services/demoServerClient.js
const axios = require('axios');
const config = require('../config');

const client = axios.create({ baseURL: config.demoServerUrl });

module.exports = {
  client,
  getCustomers: (filters) => client.get('/api/customers', { params: filters }),
  getCustomerById: (id) => client.get(`/api/customers/${id}/snapshot`),
  getPortfolioStats: () => client.get('/api/core-banking/portfolio-stats'),
  getAppEngagement: (id) => client.get(`/api/app-events/engagement/${id}`),
  getCrmSummary: (id) => client.get(`/api/crm/summary/${id}`),
  getStressIndicators: (id) => client.get(`/api/core-banking/stress/${id}`),
  getLocationSeries: (id) => client.get(`/api/core-banking/location/${id}`),
  getMarketSignals: () => client.get('/api/core-banking/market-signals'),
  getTransactions: (params) => client.get('/api/core-banking/transactions', { params }),
};
```

### 3.7 Verification

```bash
# Start server
cd server && node index.js

# Test login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"analyst","password":"analyst123"}' | jq .

# Test key endpoints (use token from above)
TOKEN="<from above>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/customers | jq .
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/portfolio/stats | jq .
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/analysis/dashboard | jq .
```

### 3.2 Environment setup

Verify `.env` contains all of the following. Create from `.env.example` if missing:

```env
DATABASE_URL=postgresql+asyncpg://pcop:pcop@localhost:5432/pcop_db
BANK_API_BASE_URL=http://localhost:3001
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=change-this-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
API_PORT=8000
```

### 3.3 Database migrations

For each table below, check if it already exists before creating a migration. Use Alembic.

**Tables required (in order of dependency):**

```
customers               → from bank API (not stored locally — fetched and cached)
signal_results          → detection outputs
churn_scores            → ML scoring outputs (seeded as dummy)
life_events             → detected life events (seeded as dummy)
campaigns               → outreach campaigns
outreach_log            → per-customer outreach records
content_store           → generated content per outreach
interaction_events      → email open/click/etc tracking
holdout_registry        → holdout group membership
outcomes                → post-outreach outcome measurement
uplift_results          → treatment vs holdout uplift
prompt_versions         → LLM prompt bank
prompt_performance      → prompt A/B stats
```

**Full DDL for each table:**

```sql
-- signal_results
CREATE TABLE IF NOT EXISTS signal_results (
  result_id     BIGSERIAL PRIMARY KEY,
  customer_id   VARCHAR(20) NOT NULL,
  signal_type   VARCHAR(50) NOT NULL,
  detected      BOOLEAN NOT NULL,
  confidence    NUMERIC(5,3),
  evidence      TEXT[],
  raw_data      JSONB,
  cusum_value   NUMERIC(10,4),
  alarm_threshold NUMERIC(10,4),
  method_used   VARCHAR(30),
  evaluated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signal_customer
  ON signal_results(customer_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_type_detected
  ON signal_results(signal_type, detected, evaluated_at DESC);

-- churn_scores
CREATE TABLE IF NOT EXISTS churn_scores (
  score_id          BIGSERIAL PRIMARY KEY,
  customer_id       VARCHAR(20) NOT NULL,
  score_date        DATE NOT NULL,
  transformer_score NUMERIC(5,4),
  xgboost_score     NUMERIC(5,4),
  final_score       NUMERIC(5,4) NOT NULL,
  confidence_lower  NUMERIC(5,4),
  confidence_upper  NUMERIC(5,4),
  risk_tier         VARCHAR(20),
  reason_codes      TEXT[],
  model_version     VARCHAR(30),
  scored_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, score_date)
);
CREATE INDEX IF NOT EXISTS idx_score_customer
  ON churn_scores(customer_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_score_tier
  ON churn_scores(risk_tier, scored_at DESC);

-- life_events
CREATE TABLE IF NOT EXISTS life_events (
  event_id        BIGSERIAL PRIMARY KEY,
  customer_id     VARCHAR(20) NOT NULL,
  event_type      VARCHAR(50) NOT NULL,
  confidence      NUMERIC(5,3),
  evidence        TEXT[],
  source          VARCHAR(30),
  risk_adjustment NUMERIC(5,3),
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_life_events_customer
  ON life_events(customer_id, detected_at DESC);

-- campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id    VARCHAR(30) PRIMARY KEY,
  campaign_name  VARCHAR(200),
  campaign_type  VARCHAR(50),
  target_segment VARCHAR(50),
  target_risk_tier VARCHAR(20),
  start_date     DATE,
  end_date       DATE,
  status         VARCHAR(20) DEFAULT 'active',
  holdout_pct    NUMERIC(5,2) DEFAULT 15.0,
  created_by     VARCHAR(50),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- outreach_log
CREATE TABLE IF NOT EXISTS outreach_log (
  outreach_id     BIGSERIAL PRIMARY KEY,
  customer_id     VARCHAR(20) NOT NULL,
  campaign_id     VARCHAR(30),
  channel         VARCHAR(20) NOT NULL,
  risk_tier       VARCHAR(20),
  life_events     TEXT[],
  offer_code      VARCHAR(50),
  content_version VARCHAR(30),
  prompt_version  VARCHAR(30),
  status          VARCHAR(20),
  dispatched_at   TIMESTAMPTZ DEFAULT NOW(),
  holdout_group   BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_outreach_customer
  ON outreach_log(customer_id, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_campaign
  ON outreach_log(campaign_id, status);

-- content_store
CREATE TABLE IF NOT EXISTS content_store (
  content_id         VARCHAR(30) PRIMARY KEY,
  outreach_id        BIGINT REFERENCES outreach_log(outreach_id),
  channel            VARCHAR(20),
  subject_line       TEXT,
  body_content       TEXT,
  cta_text           VARCHAR(100),
  offer_details      JSONB,
  compliance_status  VARCHAR(20),
  compliance_notes   TEXT,
  prompt_version     VARCHAR(30),
  llm_model          VARCHAR(50),
  generated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- interaction_events
CREATE TABLE IF NOT EXISTS interaction_events (
  interaction_id  BIGSERIAL PRIMARY KEY,
  outreach_id     BIGINT NOT NULL,
  customer_id     VARCHAR(20) NOT NULL,
  channel         VARCHAR(20),
  event_type      VARCHAR(50),
  event_value     NUMERIC(10,2),
  event_timestamp TIMESTAMPTZ NOT NULL,
  metadata        JSONB
);
CREATE INDEX IF NOT EXISTS idx_interaction_outreach
  ON interaction_events(outreach_id);
CREATE INDEX IF NOT EXISTS idx_interaction_customer
  ON interaction_events(customer_id, event_timestamp DESC);

-- holdout_registry
CREATE TABLE IF NOT EXISTS holdout_registry (
  registry_id          BIGSERIAL PRIMARY KEY,
  customer_id          VARCHAR(20) NOT NULL UNIQUE,
  campaign_id          VARCHAR(30) NOT NULL,
  risk_score_at_entry  NUMERIC(5,4),
  risk_tier_at_entry   VARCHAR(20),
  entered_holdout_at   TIMESTAMPTZ DEFAULT NOW(),
  exited_holdout_at    TIMESTAMPTZ,
  exit_reason          VARCHAR(50)
);

-- outcomes
CREATE TABLE IF NOT EXISTS outcomes (
  outcome_id         BIGSERIAL PRIMARY KEY,
  customer_id        VARCHAR(20) NOT NULL,
  outreach_id        BIGINT,
  holdout_group      BOOLEAN DEFAULT FALSE,
  outcome_label      VARCHAR(30),
  observation_window INTEGER,
  txn_volume_change  NUMERIC(8,2),
  engagement_change  NUMERIC(8,2),
  balance_change     NUMERIC(18,2),
  products_closed    INTEGER DEFAULT 0,
  measured_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outcomes_customer
  ON outcomes(customer_id, measured_at DESC);

-- uplift_results
CREATE TABLE IF NOT EXISTS uplift_results (
  uplift_id                 BIGSERIAL PRIMARY KEY,
  campaign_id               VARCHAR(30),
  channel                   VARCHAR(20),
  segment                   VARCHAR(30),
  risk_tier                 VARCHAR(20),
  treatment_retention_rate  NUMERIC(6,4),
  holdout_retention_rate    NUMERIC(6,4),
  uplift_pct                NUMERIC(6,4),
  psm_adjusted              BOOLEAN DEFAULT FALSE,
  sample_size_treatment     INTEGER,
  sample_size_holdout       INTEGER,
  calculated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- prompt_versions
CREATE TABLE IF NOT EXISTS prompt_versions (
  version_id        VARCHAR(30) PRIMARY KEY,
  channel           VARCHAR(20),
  segment           VARCHAR(30),
  risk_tier         VARCHAR(20),
  system_prompt     TEXT NOT NULL,
  few_shot_examples JSONB,
  tone_instructions TEXT,
  offer_instructions TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  deprecated_at     TIMESTAMPTZ
);

-- prompt_performance
CREATE TABLE IF NOT EXISTS prompt_performance (
  perf_id         BIGSERIAL PRIMARY KEY,
  version_id      VARCHAR(30) REFERENCES prompt_versions(version_id),
  impressions     INTEGER DEFAULT 0,
  conversions     INTEGER DEFAULT 0,
  conversion_rate NUMERIC(6,4),
  bandit_alpha    NUMERIC(10,4) DEFAULT 1.0,
  bandit_beta     NUMERIC(10,4) DEFAULT 1.0,
  last_updated    TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 Seed data for server DB

Create `server/api/db/seed.py`. Run with `python -m api.db.seed`. Before inserting, check if records already exist using `ON CONFLICT DO NOTHING`.

#### Churn scores (seed one record per customer for today's date)

```python
CHURN_SCORES = [
  ("C-00000001", 0.8700, 0.8500, 0.8700, 0.82, 0.92, "critical",
   ["Employer changed to Infosys", "City shifted to Bangalore", "Unresolved fee complaint"]),
  ("C-00000002", 0.7100, 0.7200, 0.7100, 0.65, 0.77, "high",
   ["Transaction frequency declining", "App engagement decay"]),
  ("C-00000003", 0.3400, 0.3300, 0.3400, 0.28, 0.40, "watch",
   ["Mild transaction frequency decline"]),
  ("C-00000004", 0.6200, 0.6100, 0.6200, 0.56, 0.68, "medium",
   ["Complaint sentiment drift", "Overdraft events increasing"]),
  ("C-00000005", 0.1900, 0.2000, 0.1900, 0.13, 0.25, "low", []),
  ("C-00000006", 0.9100, 0.9000, 0.9100, 0.86, 0.96, "critical",
   ["BOCPD joint alarm", "Bereavement CRM note", "Transaction volume collapse"]),
  ("C-00000007", 0.7800, 0.7700, 0.7800, 0.72, 0.84, "high",
   ["Engagement decay", "Competitor rate change signal"]),
  ("C-00000008", 0.4400, 0.4500, 0.4400, 0.38, 0.50, "medium",
   ["Salary credit decreased 18%"]),
  ("C-00000009", 0.5500, 0.5600, 0.5500, 0.49, 0.61, "medium",
   ["Complaint sentiment deteriorating", "Transaction frequency decline"]),
  ("C-00000010", 0.2200, 0.2100, 0.2200, 0.16, 0.28, "low", []),
  ("C-00000011", 0.6600, 0.6500, 0.6600, 0.60, 0.72, "high",
   ["Digital engagement drop", "Complaint sentiment drift"]),
  ("C-00000012", 0.8900, 0.8800, 0.8900, 0.84, 0.94, "critical",
   ["Job change detected", "All engagement signals firing", "Market signal active"]),
  ("C-00000013", 0.4100, 0.4200, 0.4100, 0.35, 0.47, "medium",
   ["Mild salary drift", "Retirement signal detected"]),
  ("C-00000014", 0.7300, 0.7400, 0.7300, 0.67, 0.79, "high",
   ["Transaction city shifted to Pune", "MCC relocation pattern"]),
  ("C-00000015", 0.2900, 0.3000, 0.2900, 0.23, 0.35, "watch",
   ["Mild financial stress MCC signal"]),
  ("C-00000016", 0.8200, 0.8100, 0.8200, 0.76, 0.88, "critical",
   ["All engagement signals active", "SPRT complaint count alarm"]),
  ("C-00000017", 0.3800, 0.3900, 0.3800, 0.32, 0.44, "watch",
   ["Mild transaction frequency decline"]),
  ("C-00000018", 0.6800, 0.6700, 0.6800, 0.62, 0.74, "high",
   ["Engagement decay across all channels"]),
  ("C-00000019", 0.5100, 0.5200, 0.5100, 0.45, 0.57, "medium",
   ["Financial stress indicators", "Unresolved complaint"]),
  ("C-00000020", 0.4700, 0.4800, 0.4700, 0.41, 0.53, "medium",
   ["Salary drift detected", "Wedding MCC pattern"]),
]
```

Also seed 90 days of historical scores per customer (randomly walk from 0.15 to current score with ±0.03 daily variance).

#### Signal results (seed latest signals per customer)

For each active signal listed in the dummy risk state table, insert one `signal_results` record with `detected=true`. For customers with no active signals, insert a sweep record with `detected=false` for each signal type.

Signal types to use: `transaction_frequency`, `salary_amount`, `digital_engagement`, `complaint_sentiment`, `stress_overdraft`, `location_city`, `lifecycle_mcc`, `joint_bocpd`.

#### Life events (seed per the dummy data table)

```python
LIFE_EVENTS = [
  ("C-00000001", "job_change", 0.85, ["Employer ref changed TCS→Infosys", "KYC employer updated"], "rule_ml", 0.15),
  ("C-00000001", "relocation", 0.80, [">60% transactions in Bangalore", "Rental agency payment in Bangalore"], "rule_ml", 0.10),
  ("C-00000006", "bereavement", 0.75, ["CRM note mentions probate", "MCC 7261 transaction", "Transaction volume collapse"], "llm_reasoning", 0.20),
  ("C-00000008", "salary_change", 0.82, ["Salary dropped from 65000 to 53000", "Same employer retained"], "rule_ml", 0.08),
  ("C-00000012", "job_change", 0.79, ["New employer detected in salary ref"], "rule_ml", 0.12),
  ("C-00000013", "retirement", 0.65, ["Age 58", "Mild salary drift", "Enquiry about pension products"], "llm_reasoning", 0.05),
  ("C-00000014", "relocation", 0.88, ["City shifted Hyderabad→Pune", "MCC 6552 real estate payment"], "rule_ml", 0.10),
  ("C-00000019", "financial_stress", 0.72, ["Overdraft events", "Repayment difficulty in CRM"], "rule_ml", 0.15),
  ("C-00000020", "marriage", 0.76, ["MCC 5944 jewellery store", "MCC 7011 hotel booking", "Wedding venue payment"], "rule_ml", -0.05),
]
```

#### Campaigns (seed 3 campaigns)

```python
CAMPAIGNS = [
  {
    "campaign_id": "CAMP-2025-Q1-RET",
    "campaign_name": "Q1 2025 Retention Drive",
    "campaign_type": "retention",
    "target_segment": None,  # all segments
    "target_risk_tier": "critical,high",
    "start_date": "2025-01-01",
    "end_date": "2025-03-31",
    "status": "completed",
    "holdout_pct": 15.0,
    "created_by": "admin"
  },
  {
    "campaign_id": "CAMP-2025-Q2-LIFE",
    "campaign_name": "Q2 Lifecycle Outreach",
    "campaign_type": "lifecycle",
    "target_segment": "Mass Affluent",
    "target_risk_tier": "medium",
    "start_date": "2025-04-01",
    "end_date": "2025-06-30",
    "status": "active",
    "holdout_pct": 15.0,
    "created_by": "admin"
  },
  {
    "campaign_id": "CAMP-2025-Q2-DIG",
    "campaign_name": "Digital Native Re-engagement",
    "campaign_type": "engagement",
    "target_segment": "Digital Native",
    "target_risk_tier": "high,critical",
    "start_date": "2025-05-01",
    "end_date": "2025-06-30",
    "status": "active",
    "holdout_pct": 15.0,
    "created_by": "admin"
  }
]
```

Seed at least 40 `outreach_log` records spread across customers and campaigns, with varied statuses (`sent`, `delivered`, `opened`, `clicked`). Seed matching `interaction_events`. Seed 5 `uplift_results` records with realistic retention rates.

### 3.5 FastAPI routers

Implement each router only if the file does not already exist or the endpoint is missing.

#### `api/routers/customers.py`

```
GET  /customers
     Query params: tier, segment, city, page (default 1), page_size (default 50), sort_by, sort_dir
     → fetches from bank API, enriches with latest churn_score from DB
     → returns paginated list of CustomerWithRisk objects

GET  /customers/{customer_id}
     → fetches from bank API, enriches with churn score history, active signals, life events, outreach history
     → returns CustomerDetail object
```

#### `api/routers/risk_scores.py`

```
GET  /scores
     Query params: tier, segment
     → returns distribution: count per tier + average score per segment

GET  /scores/{customer_id}
     Query params: days (default 90)
     → returns list of daily churn_scores for this customer (last N days)
```

#### `api/routers/signals.py`

```
GET  /signals
     Query params: signal_type, detected_only (default true), page, page_size
     → returns latest signal_results per customer where detected=true

GET  /signals/{customer_id}
     → returns all signal_results for this customer (last 30 days)
```

#### `api/routers/life_events.py`

```
GET  /life-events/{customer_id}
     → returns all life_events for this customer, ordered by detected_at desc
```

#### `api/routers/outreach.py`

```
GET  /outreach
     Query params: customer_id, campaign_id, channel, status, page, page_size
     → returns outreach_log records with content_store joined

POST /outreach/trigger
     Body: { customer_id: str, channel: str, note: str }
     Auth: manager or admin role required
     → creates outreach_log record with status="sent", returns outreach_id

GET  /outreach/{outreach_id}
     → returns outreach_log + content_store record for this ID

GET  /campaigns
     → returns all campaigns with aggregated stats (sent count, delivery rate, conversion rate, uplift)
```

#### `api/routers/outcomes.py`

```
GET  /outcomes
     Query params: campaign_id, observation_window (1|7|30)
     → returns outcomes records

GET  /analytics/uplift
     Query params: campaign_id, segment, channel
     → returns uplift_results records
```

#### `api/routers/analytics.py`

```
GET  /analytics/dashboard
     → returns:
       {
         risk_distribution: { critical: N, high: N, medium: N, watch: N, low: N },
         critical_customers_today: N,
         outreach_sent_this_week: N,
         cusum_alarms_today: N,
         retention_uplift_pct: float,
         campaign_performance: [{ channel, conversion_rate }],
         risk_trend_30d: [{ date, avg_score }],
         insight_cards: [{ severity, title, description }]
       }

GET  /analytics/warnings
     → returns last 50 active alarms sorted by severity:
       [{ severity, title, description, affected_customers, signal_type, timestamp }]

WS   /ws/warnings
     → WebSocket endpoint; on connect, sends current warnings; subsequently pushes
       new alarm events published to Redis channel "pcop:alarms"
```

#### `api/routers/auth.py`

```
POST /auth/token
     Body: { username: str, password: str }
     → returns { access_token, token_type: "bearer" }

Seed these users in the DB (hashed passwords):
  analyst  / analyst123   → role: analyst
  manager  / manager123   → role: manager
  admin    / admin123     → role: admin
```

### 3.6 Pydantic response models

Create `api/models/` with one file per domain. Key models:

```python
# api/models/customer.py
class CustomerSummary(BaseModel):
    customer_id: str
    full_name: str
    segment: str
    city: str
    tenure_years: float
    preferred_channel: str
    current_risk_score: float
    risk_tier: str
    active_signals: list[str]
    life_events: list[str]
    relationship_manager_id: str | None

class CustomerDetail(CustomerSummary):
    email: str
    phone_mobile: str
    accounts: list[dict]
    score_history: list[dict]        # last 90 days
    active_signal_details: list[dict]
    life_event_details: list[dict]
    outreach_history: list[dict]

# api/models/risk.py
class RiskDistribution(BaseModel):
    critical: int
    high: int
    medium: int
    watch: int
    low: int

class ScoreHistory(BaseModel):
    score_date: date
    final_score: float
    risk_tier: str
    reason_codes: list[str]

# api/models/signal.py
class SignalResult(BaseModel):
    result_id: int
    customer_id: str
    signal_type: str
    detected: bool
    confidence: float
    evidence: list[str]
    cusum_value: float | None
    alarm_threshold: float | None
    method_used: str
    evaluated_at: datetime

# api/models/analytics.py
class Warning(BaseModel):
    severity: Literal["critical", "medium", "info"]
    title: str
    description: str
    affected_customers: int
    signal_type: str
    timestamp: datetime

class InsightCard(BaseModel):
    severity: Literal["critical", "warning", "info"]
    title: str
    description: str
```

### 3.7 Auth middleware

```python
# api/dependencies.py
# Implement get_current_user() using JWT bearer token
# Implement require_role("manager") and require_role("admin") dependency factories
# All read endpoints require at minimum analyst role (any valid JWT)
# POST /outreach/trigger requires manager or admin
```

### 3.8 Verification

```bash
# Run migrations
cd server && alembic upgrade head

# Run seed
python -m api.db.seed

# Start server
uvicorn api.main:app --port 8000 --reload

# Test auth
curl -X POST http://localhost:8000/auth/token \
  -d "username=analyst&password=analyst123" | jq .

# Test key endpoints (use token from above)
TOKEN="<from above>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/customers | jq length
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/scores | jq .
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8000/signals?detected_only=true" | jq length
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/analytics/dashboard | jq .
```

---

## 4. CLIENT (React + TypeScript)

### 4.1 Check existing implementation

```bash
# Check which pages exist
ls client/src/pages/

# Check which components exist
ls client/src/components/

# Check installed dependencies
cat client/package.json | jq '.dependencies'
```

### 4.2 Required dependencies

Verify these are in `package.json`. Install any missing ones:

```json
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "react-router-dom": "^6.x",
  "@tanstack/react-query": "^5.x",
  "axios": "^1.x",
  "recharts": "^2.x",
  "date-fns": "^3.x",
  "lucide-react": "^0.383.0",
  "clsx": "^2.x",
  "tailwindcss": "^3.x"
}
```

### 4.3 TypeScript types

Check `client/src/types/index.ts`. Add any missing types:

```typescript
export type RiskTier = 'critical' | 'high' | 'medium' | 'watch' | 'low';
export type Channel = 'email' | 'sms' | 'app' | 'call' | 'rm_visit';
export type Segment = 'HNW' | 'Mass Affluent' | 'Mass Market' | 'Digital Native';

export interface CustomerSummary {
  customer_id: string;
  full_name: string;
  segment: Segment;
  city: string;
  tenure_years: number;
  preferred_channel: Channel;
  current_risk_score: number;
  risk_tier: RiskTier;
  active_signals: string[];
  life_events: string[];
  relationship_manager_id?: string;
}

export interface CustomerDetail extends CustomerSummary {
  email: string;
  phone_mobile: string;
  accounts: Account[];
  score_history: ScoreHistory[];
  active_signal_details: SignalResult[];
  life_event_details: LifeEvent[];
  outreach_history: OutreachRecord[];
}

export interface Account {
  account_id: string;
  account_type: string;
  balance: number;
  status: string;
  opened_date: string;
}

export interface ScoreHistory {
  score_date: string;
  final_score: number;
  risk_tier: RiskTier;
  reason_codes: string[];
}

export interface SignalResult {
  result_id: number;
  signal_type: string;
  detected: boolean;
  confidence: number;
  evidence: string[];
  cusum_value?: number;
  alarm_threshold?: number;
  method_used: string;
  evaluated_at: string;
}

export interface LifeEvent {
  event_id: number;
  event_type: string;
  confidence: number;
  evidence: string[];
  source: 'rule_ml' | 'llm_reasoning';
  risk_adjustment: number;
  detected_at: string;
}

export interface OutreachRecord {
  outreach_id: number;
  channel: Channel;
  campaign_id: string;
  status: string;
  risk_tier: RiskTier;
  offer_code?: string;
  dispatched_at: string;
  content?: ContentPreview;
}

export interface ContentPreview {
  subject_line?: string;
  body_content: string;
  cta_text?: string;
  compliance_status: 'passed' | 'failed' | 'manual_review';
}

export interface Warning {
  severity: 'critical' | 'medium' | 'info';
  title: string;
  description: string;
  affected_customers: number;
  signal_type: string;
  timestamp: string;
}

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  campaign_type: string;
  target_segment?: string;
  target_risk_tier: string;
  start_date: string;
  end_date: string;
  status: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    converted: number;
    uplift_pct?: number;
  };
}

export interface DashboardData {
  risk_distribution: Record<RiskTier, number>;
  critical_customers_today: number;
  outreach_sent_this_week: number;
  cusum_alarms_today: number;
  retention_uplift_pct: number;
  campaign_performance: { channel: string; conversion_rate: number }[];
  risk_trend_30d: { date: string; avg_score: number }[];
  insight_cards: { severity: string; title: string; description: string }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
```

### 4.4 API client

Check `client/src/api/client.ts`. Ensure it:
- Sets `baseURL` from `import.meta.env.VITE_API_BASE_URL`
- Attaches JWT from `localStorage` on every request via a request interceptor
- On 401 response, clears the token and redirects to `/login`

### 4.5 TanStack Query hooks

Check `client/src/hooks/`. Implement any missing hooks:

```typescript
// useCustomers.ts
export function useCustomers(filters: CustomerFilters): UseQueryResult<PaginatedResponse<CustomerSummary>>

// useCustomer.ts
export function useCustomer(customerId: string): UseQueryResult<CustomerDetail>

// useRiskScores.ts
export function useRiskDistribution(): UseQueryResult<Record<RiskTier, number>>
export function useScoreHistory(customerId: string, days?: number): UseQueryResult<ScoreHistory[]>

// useSignals.ts
export function useSignals(filters: SignalFilters): UseQueryResult<SignalResult[]>
export function useCustomerSignals(customerId: string): UseQueryResult<SignalResult[]>

// useAnalytics.ts
export function useDashboard(): UseQueryResult<DashboardData>
export function useWarnings(): UseQueryResult<Warning[]>   // refetchInterval: 30_000

// useOutreach.ts
export function useCampaigns(): UseQueryResult<Campaign[]>
export function useOutreach(filters: OutreachFilters): UseQueryResult<PaginatedResponse<OutreachRecord>>
export function useTriggerOutreach(): UseMutationResult
```

### 4.6 Pages

For each page, check if the file exists and all required components are present. Implement missing ones.

---

#### Page 1: Main Dashboard `/`

**File:** `client/src/pages/Dashboard.tsx`

**Components to build** (check each individually):

`RiskDistributionChart`
- Donut chart (Recharts `PieChart`) showing customer count per tier
- Colour coding: critical=red, high=orange, medium=yellow, watch=blue, low=green
- Legend below chart with counts and percentages
- Data from `useRiskDistribution()`

`KeyMetricCards`
- Four cards in a 2×2 grid (or 4-column row on desktop):
  1. "Critical Customers" — count with red badge, trend arrow vs yesterday
  2. "Outreach This Week" — count with channel breakdown tooltip
  3. "Retention Uplift" — percentage vs holdout with confidence interval
  4. "Alarms Today" — CUSUM alarm count with signal type breakdown
- Data from `useDashboard()`

`LLMInsightCards`
- Horizontally scrollable row of 3 insight cards
- Each card: severity colour strip on left, title (bold), description text, relative timestamp
- Data from `useDashboard().insight_cards`

`CampaignPerformanceChart`
- Horizontal bar chart (Recharts `BarChart`) with conversion rate per channel
- Bars coloured by channel type
- Data from `useDashboard().campaign_performance`

`RiskTrendLine`
- 30-day sparkline (Recharts `LineChart`) of average portfolio churn score
- Reference line at 0.65 (high-risk threshold) in orange
- Data from `useDashboard().risk_trend_30d`

`WarningFeed`
- Scrollable list (max 8 visible, scroll for more)
- Each item: severity icon, title, description (truncated to 2 lines), affected customer count, timestamp
- Severity colour: critical=red, medium=amber, info=blue
- Auto-refreshes every 30s via `useWarnings()`

---

#### Page 2: Customer List `/customers`

**File:** `client/src/pages/CustomerList.tsx`

**Components:**

`CustomerTable`
- Columns: Customer ID, Name, Segment (badge), City, Tenure, Risk Score (numeric + colour bar), Risk Tier (badge), Active Signals (pill tags, max 2 + "N more"), Life Events (pill tags), Last Outreach date
- Sort on any column
- Click row → navigate to `/customers/:id`

`CustomerFilters` (sidebar or top bar)
- Risk Tier: multi-select checkboxes (Critical / High / Medium / Watch / Low)
- Segment: multi-select
- City: text search
- Active Signal Type: dropdown

`Pagination`
- 50 per page, prev/next buttons, page number display, total record count

---

#### Page 3: Customer Detail `/customers/:id`

**File:** `client/src/pages/CustomerDetail.tsx`

**Sections:**

`CustomerProfileHeader`
- Name, segment badge, tenure text, risk score (large number + tier badge)
- Preferred channel icon, RM name if present
- Opt-out channel indicators (crossed-out icons for opted-out channels)

`RiskScoreTimeline`
- 90-day Recharts `LineChart`
- Y-axis: 0 to 1, reference lines at 0.40 (medium), 0.65 (high), 0.85 (critical)
- Annotate with life event vertical markers (red dashed) and outreach dispatch markers (green dots)
- Data from `useScoreHistory(customerId, 90)`

`ActiveSignalsPanel`
- Card grid, one card per active signal
- Each card: signal type name, method badge, confidence bar (0–1), top 2 evidence strings
- Optional mini-bar showing CUSUM value vs threshold
- Data from `useCustomerSignals(customerId)` filtered to `detected === true`

`LifeEventsTimeline`
- Vertical timeline component (left border with dots)
- Each item: event type icon + name, confidence percentage, evidence list, source badge (rule/LLM), relative timestamp

`OutreachHistoryTable`
- Columns: Date, Channel, Campaign, Status, Content (expandable row for preview)
- Status badges: sent=grey, delivered=blue, opened=purple, clicked=green, failed=red

`TransactionTrendCharts`
- Three small `LineChart` components in a row:
  1. Transaction frequency (30-day rolling count)
  2. Average transaction amount
  3. Digital engagement score (0–100)
- Overlay CUSUM alarm threshold as dashed horizontal line where applicable

`ManualOutreachTrigger`
- Only render if current user role is `manager` or `admin`
- Channel dropdown (email / sms / app / call / rm_visit)
- Note textarea
- Submit button calls `POST /outreach/trigger`

---

#### Page 4: Signal Monitor `/signals`

**File:** `client/src/pages/SignalMonitor.tsx`

**Components:**

`AlarmTable`
- All customers with `detected=true` signals
- Columns: Customer ID, Customer Name, Signal Type, Method badge, Severity (derived from confidence), CUSUM Value / Threshold (ratio), Top Evidence (truncated), Time Fired
- Sort by severity by default

`SignalTypeBreakdown`
- Stacked `BarChart` (Recharts) — last 7 days
- X-axis: dates, Y-axis: alarm count
- Stacked by signal type (different colours per type)

---

#### Page 5: Outreach Hub `/outreach`

**File:** `client/src/pages/OutreachHub.tsx`

**Components:**

`CampaignList`
- Table: Campaign Name, Type, Target, Status badge, Date range, Sent, Delivered %, Open %, Conversion %, Uplift vs holdout
- Click to expand → shows channel breakdown

`OutreachQueue`
- Pending items where `status = 'manual_review'` or `status = 'failed'`
- Each item: customer name, channel, reason for hold, Approve / Reject buttons (manager+ only)

`ContentPreviewPanel`
- Right-side panel (or modal) triggered by clicking any outreach row
- Shows: channel, subject line (if email), body content, CTA, compliance status badge + notes
- Prompt version used

`ChannelPerformanceSummary`
- Grouped `BarChart`: conversion rate grouped by (channel × risk tier)

---

#### Page 6: Analytics `/analytics`

**File:** `client/src/pages/Analytics.tsx`

**Components:**

`UpliftBySegmentChart`
- Grouped `BarChart` with two bars per segment: treatment retention rate vs holdout retention rate
- Delta (uplift) labelled above each pair
- Data from `GET /analytics/uplift`

`PromptBankTable`
- Table of `prompt_versions` with performance stats
- Columns: Version ID, Channel, Segment, Risk Tier, Impressions, Conversions, Conversion Rate, α/β (Thompson params), Status
- Active versions highlighted

`ModelDriftMonitor`
- Line chart: predicted score distribution vs actual churn rate over time
- Two lines: `avg_predicted_score` and `actual_churn_rate` (for outcome-labelled customers)
- Placeholder data if insufficient outcome labels

`CohortOutcomeHeatmap`
- Grid component (CSS grid, not a library heatmap)
- X-axis: outreach channels, Y-axis: life event types
- Cell: retention rate percentage, colour-coded green (high) to red (low)
- Data synthesised from `outcomes` + `life_events` join

---

### 4.7 Layout and navigation

**File:** `client/src/components/layout/`

`Sidebar`
- Logo at top
- Navigation links: Dashboard, Customers, Signal Monitor, Outreach Hub, Analytics
- Active link highlighted
- User info + logout at bottom

`TopBar`
- Page title (dynamic)
- Role badge (analyst / manager / admin)
- Global search (searches customer name/ID, navigates to customer detail)

`PageWrapper`
- Wraps page content with consistent padding and `<Suspense>` boundary

### 4.8 Auth pages

`client/src/pages/Login.tsx`
- Username + password form
- On success: stores JWT in `localStorage`, redirects to `/`
- On failure: shows error message

`client/src/components/ProtectedRoute.tsx`
- Redirects to `/login` if no valid JWT in localStorage

### 4.9 Risk tier colour utility

```typescript
// client/src/lib/riskColors.ts
export const TIER_COLORS: Record<RiskTier, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  medium:   { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  watch:    { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300' },
  low:      { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
};
```

### 4.10 Verification

```bash
cd client && npm run dev
# Open http://localhost:5173

# Login with analyst/analyst123
# Verify:
#   - Dashboard loads with all 6 components showing data
#   - Customer list shows 20 customers with risk badges
#   - Click C-00000001 → detail page shows score history chart
#   - Signal Monitor shows alarms for critical/high customers
#   - Outreach Hub shows 3 campaigns
#   - Analytics page loads all 4 chart components

npm run typecheck    # zero TypeScript errors
npm run lint         # zero lint errors
```

---

## 5. CROSS-CUTTING CONCERNS

### 5.1 CORS

Express server must allow `http://localhost:5173` during development. In production, restrict to the actual domain.

### 5.2 Error handling

- Bank server: all unhandled errors return `{ error: string, code: number }` with appropriate HTTP status.
- Express server: use standard error handling middleware. All error responses return `{ status: 'error', message: string }`.
- React: each page wrapped in an `ErrorBoundary` that shows a user-friendly error card with a retry button. TanStack Query `error` state shown inline in components.

### 5.3 Loading states

All data-fetching components must show skeleton loaders (not spinners) while loading. Use CSS `animate-pulse` with grey placeholder blocks matching the shape of the loaded content.

### 5.4 Pagination

All list endpoints that can return more than 20 records must support `page` and `page_size`. Frontend components must handle pagination state through URL search params (e.g., `?page=2`), so that the browser back button works.

### 5.5 Environment variable naming

| Variable | Bank server | Express server | React client |
|---|---|---|---|
| API port | `PORT=3001` | `PORT=8000` | `VITE_API_BASE_URL=http://localhost:8000` |
| Bank API URL | — | `BANK_API_BASE_URL=http://localhost:3001` | — |

---

## 6. DOCKER COMPOSE

Check `docker-compose.yml`. Ensure these services are defined:

```yaml
services:
  bank:
    build: ./bank
    ports: ["3001:3001"]
    environment:
      PORT: 3001

  server:
    build: ./server
    ports: ["8000:8000"]
    environment:
      PORT: 8000
      BANK_API_BASE_URL: http://bank:3001
    depends_on: [bank]

  client:
    build: ./client
    ports: ["5173:5173"]
    environment:
      VITE_API_BASE_URL: http://localhost:8000
    depends_on: [server]
```

---

## 7. IMPLEMENTATION ORDER

Follow this order to avoid dependency issues:

1. **Bank server** — seed data + all endpoints (Section 2)
2. **Server setup** — Express boilerplate, config, middleware (Section 3.1-3.2)
3. **Server seed data** — in-memory stores for scores, signals, life events, campaigns (Section 3.3)
4. **Server auth** — login endpoint + JWT middleware (Section 3.4 auth.js)
5. **Server demo client** — bank API client (Section 3.6)
6. **Server read endpoints** — customers, portfolio routes (Section 3.4)
7. **Server analytics endpoints** — dashboard, warnings (Section 3.4)
8. **Server outreach endpoints** — campaigns, outreach CRUD (Section 3.4)
9. **React auth** — login page + ProtectedRoute (Section 4.8)
10. **React layout** — Sidebar + TopBar + PageWrapper (Section 4.7)
11. **React hooks** — all TanStack Query hooks (Section 4.5)
12. **Dashboard page** — all 6 components (Section 4.6, Page 1)
13. **Customer List page** (Section 4.6, Page 2)
14. **Customer Detail page** (Section 4.6, Page 3)
15. **Signal Monitor page** (Section 4.6, Page 4)
16. **Outreach Hub page** (Section 4.6, Page 5)
17. **Analytics page** (Section 4.6, Page 6)

---

## 8. QUICK REFERENCE — ALL ENDPOINTS

### Bank (port 3001)
| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| GET | /customers | All 20 customers |
| GET | /customers/:id | Single customer |
| GET | /accounts | All accounts (filter: ?customer_id=) |
| GET | /transactions | Transactions (filter: ?customer_id=, ?limit=, ?offset=) |
| GET | /crm-notes | CRM notes (filter: ?customer_id=) |
| GET | /app-events | App events (filter: ?customer_id=, ?limit=) |
| GET | /account-events | Account lifecycle events |
| GET | /kyc-updates | KYC history |
| GET | /external-enrichment | External enrichment data |

### Server (port 8000)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/login | None | Get JWT |
| GET | /api/customers | analyst | Paginated customer list with risk |
| GET | /api/customers/:id | analyst | Full customer detail |
| GET | /api/customers/:id/signals | analyst | Customer signals |
| GET | /api/customers/:id/transactions | analyst | Customer transactions |
| GET | /api/customers/:id/insights | analyst | Customer insights |
| GET | /api/portfolio/stats | analyst | Portfolio statistics |
| GET | /api/portfolio/risk-distribution | analyst | Risk tier distribution |
| GET | /api/portfolio/churn-trend | analyst | Churn trend data |
| GET | /api/portfolio/signal-breakdown | analyst | Signal type counts |
| GET | /api/portfolio/top-at-risk | analyst | Top N at-risk customers |
| GET | /api/portfolio/market-signals | analyst | Market signals |
| GET | /api/outreach | analyst | Outreach records |
| POST | /api/outreach | manager | Create outreach record |
| GET | /api/outreach/:id | analyst | Outreach detail |
| GET | /api/campaigns | analyst | Campaigns with stats |
| GET | /api/analysis/dashboard | analyst | Dashboard aggregates |
| GET | /api/analysis/warnings | analyst | Active warnings |
| GET | /api/analytics/uplift | analyst | Uplift results |
