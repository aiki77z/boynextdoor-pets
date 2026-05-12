# Catbbi Hatch Runbook

## Purpose

This runbook turns the Catbbi prompt into an actual hatch-pet run with standard outputs:

- `pet.json`
- `spritesheet.webp`
- QA contact sheet
- validation report
- preview videos

## Suggested Folder Layout

```text
D:/pet/
  prompts/
    catbbi-hatch-prompt.md
    catbbi-hatch-asset-spec.md
    catbbi-hatch-runbook.md
  references/
    catbbi/
      01-identity-front.jpg
      02-structure-breakdown.jpg
      03-style-notes.md
  hatch-runs/
    catbbi/
```

## Recommended Reference Set

Put Catbbi's reference pack in:

`D:/pet/references/catbbi/`

Priority order:

1. main identity front image
2. structure / decomposition reference
3. style notes

## Prepare Command

Run hatch-pet preparation with a concise one-sentence description plus the stable notes from the spec:

```powershell
python "$env:CODEX_HOME\\skills\\hatch-pet\\scripts\\prepare_pet_run.py" `
  --pet-name "Catbbi" `
  --description "A soft 2D mascot-style white cat desktop pet with a very large head, tiny body, long whiskers, orange ear tips, and a shy sweet superstar feeling." `
  --reference "D:/pet/references/catbbi/01-identity-front.jpg" `
  --output-dir "D:/pet/hatch-runs/catbbi" `
  --pet-notes "Milk-white cat, pointed ears with orange tips, orange forehead patch, asymmetric beige face patches, black oval eyes with white rims, long whiskers, orange chest clover mark, no 3D, no realism, no pixel-art conversion." `
  --style-notes "Soft 2D mascot desktop pet, clean chibi proportions, gentle simple shading allowed, transparent-ready sprite, big-head tiny-body silhouette, not pixel art, not plush render, not clay render." `
  --force
```

## First Generation Order

When the run is prepared, generate in this order:

1. `base`
2. `idle`
3. `running-right`
4. inspect identity consistency
5. remaining rows

This keeps Catbbi from drifting too early.

## Acceptance Checklist

Catbbi is ready only if all of these hold:

- ears stay pointed and orange-tipped
- forehead patch stays visible
- eyes keep white rims
- whiskers stay long and fine
- chest clover remains readable
- body stays tiny relative to the head
- no row turns Catbbi into a generic round cat
- no row introduces 3D shading or plush texture

## After Catbbi Passes

Catbbi becomes the style benchmark for:

- Dalring
- Myngmyng
- Han Tatpung
- 312
- Woonbaby

The remaining five pets should be normalized against Catbbi's outline weight, readability, and motion restraint.
