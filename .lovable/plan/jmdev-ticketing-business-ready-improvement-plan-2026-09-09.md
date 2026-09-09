# JMdev Ticketing — Business-Ready Improvement Plan

## Goal

Turn the current internal ticketing system into a client-ready service desk for JMdev.co.za that handles web development, repairs, design, SEO/marketing, and IT support. The focus is on letting clients raise and track requests, giving staff clear SLAs and deadlines, sending useful email updates, and adding reporting that shows how the team is performing.

## Phase 1 — Client portal & access

- Add a **client** role alongside admin, agent, and user.
- Build an admin "invite client" flow so JMdev staff can create client accounts without opening public sign-up.
- Create a simplified **client dashboard** where clients see only their own tickets, can create new requests, and add comments.
- Add a **service type** field to tickets (Web Development, PC / Console Repairs, Graphic Design, SEO / Marketing, Network / On-site Support, General) so requests are routed correctly.
- Make sure clients cannot see internal notes, other clients' tickets, or team-only data.

## Phase 2 — SLAs & deadlines

- Add SLA configuration per service type and priority (e.g. first response within 4 hours, resolution within 48 hours for critical web issues).
- Store **response due** and **resolution due** timestamps on each ticket.
- Show overdue warnings on the ticket list, dashboard, and ticket detail pages.
- Add an "SLA status" badge (On track, At risk, Breached) and a filter for overdue tickets.
- Log SLA events in the activity timeline.

## Phase 3 — Email notifications

- Set up Lovable app emails on a JMdev subdomain (e.g. `notify.jmdev.co.za`).
- Send transactional emails for: new ticket created, ticket assigned, status changed, new comment, SLA breach warning.
- Let users choose which notifications they receive in Settings.
- Include ticket details and a direct link back to the app in every email.

## Phase 4 — Reporting & analytics

- Expand the dashboard with charts: tickets opened vs closed over time, average resolution time, tickets by service type, and agent workload.
- Add a dedicated **Reports** page with date-range filtering and the ability to export to CSV.
- Track key metrics: first response time, resolution time, reopen rate, and SLA breach rate.

## Phase 5 — POPIA compliance, branding & domain

- Add Privacy Policy, Terms of Use, and Cookie Policy pages written for South African POPIA compliance.
- Connect the app to a custom domain (`support.jmdev.co.za` or `tickets.jmdev.co.za`).
- Apply JMdev branding: logo, brand colours, and a favicon that match jmdev.co.za.
- Add a public landing page that explains the service and lets clients request access.

## Technical details

- Database: add `service_types` lookup table, `sla_rules` table, and `clients` profile extension or reuse `profiles` with a `client` flag. Add `response_due_at`, `resolution_due_at`, and `first_responded_at` columns to `tickets`.
- RLS: ensure clients only see tickets where `author_id = auth.uid()` or where they are listed as the client contact. Staff continue to see all tickets.
- Edge Functions: extend `manage-users` to support client invites; add an SLA calculation function; add email trigger helpers.
- Frontend: new `ClientDashboard` page, `Reports` page, SLA badge component, and notification preferences in Settings.
- Email: use `email_domain--setup_email_infra` and `email_domain--scaffold_transactional_email`, then create templates for ticket events.
- Compliance: static pages under `/privacy`, `/terms`, and `/cookies` linked in the footer.

## Out of scope for this plan

- Billing / invoicing integration.
- Live chat or chatbot.
- Mobile native apps.
- Marketing email campaigns.
