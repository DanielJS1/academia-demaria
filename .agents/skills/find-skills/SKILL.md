\---

name: find-skills

description: Discovers, searches, and installs open agent skills from the ecosystem registry.

when\_to\_use: When the user asks "how do I do X" with common tasks, asks "is there a skill for X", wants to extend agent capabilities, or explicitly asks to search for tools, workflows, or packages.

argument-hint: \[query-term]

\---



\# Find Skills



This skill helps the agent discover, verify, and install skills from the open agent skills ecosystem using the Vercel Labs Skills CLI.



\## How to Use



When the user asks to find, search, or install a skill, execute the appropriate terminal command or present the options directly.



\### Key Commands

\* \*\*Search:\*\* `npx skills find \[query]` (e.g., `npx skills find react performance`)

\* \*\*Install:\*\* `npx skills add <package>` (e.g., `npx skills add vercel-labs/skills@find-skills`)

\* \*\*Update:\*\* `npx skills update`



\### Quality Guidelines

Before recommending or auto-installing an discovered skill, ensure the agent or user checks:

1\. \*\*Source Reputation:\*\* Trust verified sources like `vercel-labs`, `anthropics`, or `microsoft`.

2\. \*\*Install Count:\*\* Favor packages with more than 1,000 installs.

3\. \*\*Stars:\*\* Validate the GitHub repository standing.



\## Troubleshooting

If an interactive terminal menu breaks during installation due to UTF-8 serialization constraints, append the `--yes` or `-y` flag alongside `--loglevel=error` to execute silently.



