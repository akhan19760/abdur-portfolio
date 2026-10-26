# State of this version

Kept by the orchestrator (the `new-version` skill) after every step. A new session
reads this first and resumes at the first unticked step.

## Steps

- [ ] Content check
- [ ] Scout and finalists board
- [ ] Direction board
- [ ] Design system
- [ ] Sections
- [ ] Whole-page check (qa)
- [ ] Finish

## Sections

Status is one of: pending, brief approved, in review, approved. An approved
section's Folder is locked against edits (scripts/hooks/lock-approved.mjs). To
unlock it, set its status back to "in review".

| Section | Folder | Status | Rounds | Commit |
| ------- | ------ | ------ | ------ | ------ |

## Notes

Worker agent ids for the current session, effort raises, and anything the next
session needs to know.
