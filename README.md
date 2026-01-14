# Entitle

A professional, developer-first marketing website for **Entitle** - a Feature Enablement as a Service (FEaaS) platform that externalizes commercial access policy from SaaS applications.

## About Entitle

Entitle is a **Policy Decision Platform (PDP)** designed for B2B SaaS companies. It externalizes entitlement logic from application code, enabling teams to manage feature access, plan entitlements, and commercial policies without touching production code.

### What Entitle Is

- **Policy Decision Platform:** Evaluates whether access to capabilities is allowed
- **Supporting Domain (DDD-Aligned):** Operates as a supporting/generic domain
- **Infrastructure-Grade:** Built for production reliability and architectural clarity
- **Incrementally Adoptable:** Shadow mode → partial enforcement → full adoption
- **Self-Governing:** Uses itself to manage its own access control

### What Entitle Is NOT

- Not a feature flag or A/B testing tool
- Not a billing or pricing system  
- Not a workflow orchestrator
- Not an enforcement engine (enforcement stays in client code)

### Core Value Proposition

> **We externalize commercial access policy — not your business logic.**

Teams using Entitle can change pricing, adjust plan entitlements, and update feature access rules without deploying code. Entitle evaluates decisions; your systems enforce them.

## Architecture

Entitle follows Domain-Driven Design (DDD) principles:

- **Clear Anti-Corruption Layer:** Integration via typed SDKs
- **Tenant Isolation:** Hard multi-tenancy with row-level security
- **Deterministic Evaluation:** Same input always produces same output
- **Progressive Adoption:** Zero-risk shadow mode for safe rollout
- **Replaceable by Design:** Clear boundaries prevent lock-in

## Site Structure

- [/](/) - Homepage: Product overview, value proposition, and architecture
- [/alpha](/alpha) - Alpha access request with progressive adoption stages
- [/docs](/docs) - Developer documentation with API reference and SDK examples
- [/security](/security) - Security, compliance, and data handling details

## Tech Stack

- **Framework:** Astro 4.x (static site generation)
- **Language:** TypeScript
- **Styling:** Native CSS with scoped component styles
- **Build Tool:** Vite (via Astro)
- **Deployment:** Static hosting (Vercel, Netlify, GitHub Pages)

## Development

Install dependencies:
```bash
npm install
```

Start development server:
```bash
npm run dev
```

Visit `http://localhost:4321`

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Target Audience

- **Primary:** CTOs, Staff/Principal Engineers, SaaS Architects
- **Companies:** B2B SaaS (Series A–C), API-first products, engineering-led teams
- **Use Cases:** Plan-based access, commercial entitlements, policy-driven feature gating

## Design Philosophy

- **Professional & Minimal:** Infrastructure-grade tone, no marketing fluff
- **Technical Accuracy:** Precise terminology, clear boundaries
- **Architectural Rigor:** DDD principles, separation of concerns
- **Developer-First:** Built for engineers who value discipline

## Project Status

**Current Phase:** Alpha  
**Purpose:** Marketing and documentation site for the Entitle platform

This website is completely static and decoupled from the Entitle backend platform.

## Repository

Platform documentation and architecture: [github.com/swapnilsingh/entitle](https://github.com/swapnilsingh/entitle)

## License

This project is open source and available under the MIT License.
