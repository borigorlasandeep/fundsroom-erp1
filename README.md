# Fundsroom Mini ERP + CRM Operations Portal

A full-stack Mini ERP + CRM Operations Portal built for the Fundsroom Infotech Full Stack Developer case study.

## Stack
- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Authentication: JWT
- API: REST

## Modules
- JWT authentication and role-based access: Admin, Sales, Warehouse, Accounts
- Customer CRM
- Product and inventory management
- Stock movement log
- Sales challans with Draft/Confirmed/Cancelled states
- Stock validation and non-negative stock protection
- Product snapshot data on challan items
- Search and pagination
- Responsive admin-style UI
- Postman collection

## Project Structure

```text
fundsroom-erp/
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── .env.example
│   └── package.json
├── postman/
│   └── Fundsroom-ERP.postman_collection.json
└── README.md
```

## Local Setup

### 1. Database

Create a PostgreSQL database named `fundsroom_erp`.

### 2. Backend

```bash
cd backend
npm install
copy .env.example .env
```

Update `.env`:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/fundsroom_erp"
JWT_SECRET="change_this_secret"
```

Then:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Backend runs at `http://localhost:5000`.

### 3. Frontend

Open another terminal:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend runs at the Vite URL shown in the terminal, normally `http://localhost:5173`.

## Demo Credentials

The seed creates:

| Role | Email | Password |
|---|---|---|
| Admin | admin@fundsroom.local | Admin@123 |
| Sales | sales@fundsroom.local | Sales@123 |
| Warehouse | warehouse@fundsroom.local | Warehouse@123 |
| Accounts | accounts@fundsroom.local | Accounts@123 |

Change these credentials before any real deployment.

## API

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:id`
- `PUT /api/customers/:id`
- `POST /api/customers/:id/follow-ups`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `POST /api/products/:id/stock`
- `GET /api/products/:id/stock-movements`
- `GET /api/challans`
- `POST /api/challans`
- `GET /api/challans/:id`
- `PATCH /api/challans/:id/status`

## Challan Business Logic

When a challan is confirmed:
1. Every product is checked for sufficient stock.
2. The whole operation is performed in a database transaction.
3. Product stock is reduced.
4. An OUT stock movement is created for each item.
5. Product name, SKU and unit price are copied into the challan item as snapshot data.
6. Negative stock is rejected.

## Environment Variables

Secrets are stored in `.env` and excluded by `.gitignore`. `.env.example` documents the required variables without real credentials.

## Deployment

The case study accepts free hosting platforms such as Vercel/Netlify for frontend and Render/Railway/Fly.io for backend, with Supabase/Neon/Render Postgres as database options. AWS is optional.

Before deployment:
- Configure production `DATABASE_URL`
- Configure a strong production `JWT_SECRET`
- Configure frontend `VITE_API_URL`
- Run Prisma migrations
- Run the backend build
- Build the frontend

## Assumptions and Limitations

- Invoice generation and PDF export are not implemented because they are bonus features.
- AWS S3 upload is not implemented because it is a bonus feature.
- The application focuses on the mandatory ERP/CRM workflow.
- Fine-grained permissions can be expanded beyond the basic role checks.
