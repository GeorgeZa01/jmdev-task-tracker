import { Ticket, User, Comment, ActivityLog } from '@/types/ticket';

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Jordan Mitchell',
    email: 'jordan@jmdev.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jordan',
    role: 'admin',
  },
  {
    id: '2',
    name: 'Alex Chen',
    email: 'alex@jmdev.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    role: 'agent',
  },
  {
    id: '3',
    name: 'Sam Rivera',
    email: 'sam@jmdev.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sam',
    role: 'agent',
  },
  {
    id: '4',
    name: 'Taylor Brooks',
    email: 'taylor@client.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=taylor',
    role: 'user',
  },
  {
    id: '5',
    name: 'Casey Morgan',
    email: 'casey@client.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=casey',
    role: 'user',
  },
];

export const currentUser = mockUsers[0];

export const mockTickets: Ticket[] = [
  {
    id: '1',
    ticketNumber: 1,
    title: 'Login page not loading on mobile devices',
    description: `## Issue Description
The login page fails to load correctly on mobile devices (iOS and Android). Users are seeing a blank white screen.

## Steps to Reproduce
1. Open the app on a mobile device
2. Navigate to the login page
3. Observe the blank screen

## Expected Behavior
The login form should display properly on all devices.

## Environment
- iOS 17.1, Safari
- Android 14, Chrome`,
    author: mockUsers[3],
    assignee: mockUsers[1],
    status: 'open',
    priority: 'critical',
    labels: ['bug'],
    comments: [
      {
        id: 'c1',
        ticketId: '1',
        author: mockUsers[1],
        content: 'I\'m investigating this issue. Can you provide the device models you tested on?',
        createdAt: new Date('2024-01-15T10:30:00'),
        updatedAt: new Date('2024-01-15T10:30:00'),
      },
      {
        id: 'c2',
        ticketId: '1',
        author: mockUsers[3],
        content: 'Sure! Tested on iPhone 15 Pro and Samsung Galaxy S23. Same issue on both.',
        createdAt: new Date('2024-01-15T11:00:00'),
        updatedAt: new Date('2024-01-15T11:00:00'),
      },
    ],
    activityLog: [
      {
        id: 'a1',
        ticketId: '1',
        user: mockUsers[3],
        action: 'created',
        createdAt: new Date('2024-01-15T09:00:00'),
      },
      {
        id: 'a2',
        ticketId: '1',
        user: mockUsers[0],
        action: 'assigned',
        details: 'Assigned to Alex Chen',
        createdAt: new Date('2024-01-15T09:30:00'),
      },
      {
        id: 'a3',
        ticketId: '1',
        user: mockUsers[0],
        action: 'labeled',
        details: 'Added bug label',
        createdAt: new Date('2024-01-15T09:31:00'),
      },
    ],
    createdAt: new Date('2024-01-15T09:00:00'),
    updatedAt: new Date('2024-01-15T11:00:00'),
  },
  {
    id: '2',
    ticketNumber: 2,
    title: 'Add dark mode support',
    description: `## Feature Request
It would be great to have a dark mode option for the dashboard.

## Motivation
Many users prefer dark mode, especially when working at night. This would improve accessibility and user experience.

## Proposed Solution
Add a toggle in the settings page to switch between light and dark themes.`,
    author: mockUsers[4],
    assignee: mockUsers[2],
    status: 'open',
    priority: 'medium',
    labels: ['feature', 'enhancement'],
    comments: [
      {
        id: 'c3',
        ticketId: '2',
        author: mockUsers[2],
        content: 'Great idea! I\'ll add this to the sprint backlog. We already have the design tokens in place.',
        createdAt: new Date('2024-01-14T15:00:00'),
        updatedAt: new Date('2024-01-14T15:00:00'),
      },
    ],
    activityLog: [
      {
        id: 'a4',
        ticketId: '2',
        user: mockUsers[4],
        action: 'created',
        createdAt: new Date('2024-01-14T14:00:00'),
      },
    ],
    createdAt: new Date('2024-01-14T14:00:00'),
    updatedAt: new Date('2024-01-14T15:00:00'),
  },
  {
    id: '3',
    ticketNumber: 3,
    title: 'API documentation needs updating',
    description: `## Documentation Issue
The API documentation is outdated and missing several endpoints that were added in v2.0.

## Missing Endpoints
- POST /api/users/invite
- DELETE /api/projects/:id
- PATCH /api/settings

Please update the docs to reflect the current API state.`,
    author: mockUsers[1],
    status: 'open',
    priority: 'low',
    labels: ['documentation'],
    comments: [],
    activityLog: [
      {
        id: 'a5',
        ticketId: '3',
        user: mockUsers[1],
        action: 'created',
        createdAt: new Date('2024-01-13T08:00:00'),
      },
    ],
    createdAt: new Date('2024-01-13T08:00:00'),
    updatedAt: new Date('2024-01-13T08:00:00'),
  },
  {
    id: '4',
    ticketNumber: 4,
    title: 'Payment processing fails for international cards',
    description: `## Bug Report
International credit cards are being rejected during checkout.

## Error Message
"Card not supported in this region"

## Impact
We're losing international customers. This is a high priority fix needed.`,
    author: mockUsers[4],
    assignee: mockUsers[0],
    status: 'open',
    priority: 'high',
    labels: ['bug'],
    comments: [
      {
        id: 'c4',
        ticketId: '4',
        author: mockUsers[0],
        content: 'Looking into the Stripe configuration. This might be a currency setting issue.',
        createdAt: new Date('2024-01-16T09:00:00'),
        updatedAt: new Date('2024-01-16T09:00:00'),
      },
    ],
    activityLog: [
      {
        id: 'a6',
        ticketId: '4',
        user: mockUsers[4],
        action: 'created',
        createdAt: new Date('2024-01-16T08:00:00'),
      },
    ],
    createdAt: new Date('2024-01-16T08:00:00'),
    updatedAt: new Date('2024-01-16T09:00:00'),
  },
  {
    id: '5',
    ticketNumber: 5,
    title: 'Improve search functionality',
    description: `## Enhancement Request
The current search only matches exact strings. Would like fuzzy search support.

## Desired Features
- Typo tolerance
- Search suggestions
- Filter by date range`,
    author: mockUsers[3],
    status: 'closed',
    priority: 'medium',
    labels: ['enhancement'],
    comments: [
      {
        id: 'c5',
        ticketId: '5',
        author: mockUsers[2],
        content: 'Implemented and deployed in v2.1.0!',
        createdAt: new Date('2024-01-12T16:00:00'),
        updatedAt: new Date('2024-01-12T16:00:00'),
      },
    ],
    activityLog: [
      {
        id: 'a7',
        ticketId: '5',
        user: mockUsers[3],
        action: 'created',
        createdAt: new Date('2024-01-10T10:00:00'),
      },
      {
        id: 'a8',
        ticketId: '5',
        user: mockUsers[2],
        action: 'closed',
        createdAt: new Date('2024-01-12T16:00:00'),
      },
    ],
    createdAt: new Date('2024-01-10T10:00:00'),
    updatedAt: new Date('2024-01-12T16:00:00'),
    closedAt: new Date('2024-01-12T16:00:00'),
  },
  {
    id: '6',
    ticketNumber: 6,
    title: 'How to integrate with Slack?',
    description: `## Question
Is there a way to integrate the ticketing system with Slack? We'd like to receive notifications when new tickets are created.`,
    author: mockUsers[4],
    status: 'closed',
    priority: 'low',
    labels: ['question'],
    comments: [
      {
        id: 'c6',
        ticketId: '6',
        author: mockUsers[1],
        content: 'Yes! Check out our integrations page at /settings/integrations. You can set up a webhook to post to any Slack channel.',
        createdAt: new Date('2024-01-11T12:00:00'),
        updatedAt: new Date('2024-01-11T12:00:00'),
      },
    ],
    activityLog: [
      {
        id: 'a9',
        ticketId: '6',
        user: mockUsers[4],
        action: 'created',
        createdAt: new Date('2024-01-11T11:00:00'),
      },
      {
        id: 'a10',
        ticketId: '6',
        user: mockUsers[1],
        action: 'closed',
        createdAt: new Date('2024-01-11T12:30:00'),
      },
    ],
    createdAt: new Date('2024-01-11T11:00:00'),
    updatedAt: new Date('2024-01-11T12:30:00'),
    closedAt: new Date('2024-01-11T12:30:00'),
  },
];
