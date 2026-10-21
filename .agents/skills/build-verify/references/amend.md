# Amend or new commit

Open on the redo path (flow Step 3/5: `CHANGES REQUIRED` was fixed and
re-verified, now commit the round).

## Rule

Amend only while HEAD is **this** task's verify commit, none of it pushed, and
no foreign work in the tree — otherwise a new commit.
--amend can only ever rewrite HEAD, never an earlier commit.

| | Amend | Amend + `--force-with-lease` (the one exception) | New commit |
|---|---|---|---|
| Condition | HEAD is **this** task's verify commit **and** none of it is pushed **and** no foreign work is in the tree | your own **fresh** commit of **this** task, the remote head is still exactly that commit, no foreign work is in the tree | everything else |
| When | redo run of the same task after `CHANGES REQUIRED` | your own fresh pushed commit is wrong (a message wording, a forgotten file) and nothing landed on top of it | new task, foreign commit in between, already pushed and not your own fresh commit, foreign work in the tree |
| Commit message | headline stays, `Verify:` footer gains the new round | headline stays, the **replaced SHA** is disclosed in the body | new `feat:`/`fix:`/`docs:` commit |

## The one exception — replacing your own fresh pushed commit

An amend of an **already pushed** commit is normally forbidden. It is allowed
once, for **your own** commit of the **current** task, when **every** condition
holds — each one is checkable:

1. **Your own, from this task.** Not a colleague's commit, not an older task's.
2. **Fresh.** The remote head of the branch is still **exactly** that commit —
   nothing landed on top of it since:
   ```sh
   git ls-remote origin <branch>   # the remote head == the commit to replace
   git rev-parse HEAD              # ... and it is HEAD locally
   ```
3. **No foreign work in the tree.**
4. **`--force-with-lease`, never `--force`** — it refuses to clobber remote
   state you have not seen.
5. **The replaced SHA is disclosed** — the SHA that was HEAD before the amend —
   in the **body of the new commit** and in the **report to the owner**. A reader
   of the remote history can then find what the commit looked like before.
6. **The difference stays recoverable** — the reflog commands below.

**CI.** A green run of the **replaced** commit attests a commit that no longer
exists — it says nothing about the new content. It is **void**: the new SHA
needs its **own** green run, watched to green, before the task counts as done
(rule 7). A replacement that touches only `*.md` files and triggers no run at
all has nothing to re-attest.

**One replacement per commit.** A commit that was already replaced (and pushed
as such) is not replaced a second time — a new commit instead: every
replacement rewrites the remote again, and the SHA the remote carried *first*
would survive only in a local reflog, where no other reader finds it.

**A repo's own branch policy wins.** The conditions above are the general ones;
a repo that documents a stricter policy keeps it (rule file, the sentence after
the rules). `agents-skills` is such a repo — its SHAs are other projects'
`skills-marker` range, so a rewritten one would leave a dangling cursor there;
it amends only while unpushed.

## Reflog — recovering the last round's delta

What changed **within** the round lives in the reflog after the amend:

```sh
git diff HEAD@{1} HEAD      # delta of the last round
git log --oneline -3        # this task's commit history
```
