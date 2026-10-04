# Amend or new commit

Open on the redo path (flow Step 3/5: `CHANGES REQUIRED` was fixed and
re-verified, now commit the round).

## Rule

Amend only while HEAD is **this** task's verify commit, none of it pushed, and
no foreign work in the tree — otherwise a new commit.
--amend can only ever rewrite HEAD, never an earlier commit.

| | Amend | New commit |
|---|---|---|
| Condition | HEAD is **this** task's verify commit **and** none of it is pushed **and** no foreign work is in the tree | everything else |
| When | redo run of the same task after `CHANGES REQUIRED` | new task, foreign commit in between, already pushed, foreign work in the tree |
| Commit message | headline stays, `Verify:` footer gains the new round | new `feat:`/`fix:`/`docs:` commit |

## Reflog — recovering the last round's delta

What changed **within** the round lives in the reflog after the amend:

```sh
git diff HEAD@{1} HEAD      # delta of the last round
git log --oneline -3        # this task's commit history
```
