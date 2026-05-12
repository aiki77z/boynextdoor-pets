# Catbbi Reference Pack Spec

## Purpose

This document defines the correct input reference pack for hatching Catbbi / 猫比 as a 2D desktop pet that matches the provided reference style.

Target style:

- not 3D
- not realistic
- not pixel art
- not plush photo realism
- not clay render
- soft, clean, flat 2D mascot feel
- slight soft shading is allowed
- should feel like an official-style chibi character sheet turned into a moving desktop pet

The main goal is likeness to the provided Catbbi image first, and animation production second.

## Main Principle

Catbbi should be guided by three kinds of references:

1. identity reference
2. structure reference
3. style rule reference

If we want strong likeness, the identity image must lead the pack.

## Recommended Folder Layout

```text
D:/pet/
  references/
    catbbi/
      01-identity-front.jpg
      02-structure-breakdown.jpg
      03-style-notes.md
      optional/
        04-alt-front.jpg
        05-face-closeup.jpg
```

## Reference Roles

### 01-identity-front.jpg

Use the clean front-facing Catbbi image with the pink background as the primary identity anchor.

This image is responsible for:

- exact head-to-body ratio
- cat head silhouette
- ear shape and orange tip placement
- face mood and expression
- beige patch placement
- eye size, tilt, and spacing
- whisker length and arc direction
- chest clover-flower shape
- overall "this is Catbbi" recognition

This is the single most important image in the pack.

### 02-structure-breakdown.jpg

Use the decomposition / breakdown image as the structural correction reference.

This image is responsible for:

- ear construction
- eye outline logic
- white eye rim shape
- whisker curve direction
- foot shape
- body contour
- face assembly logic

This image is used to stop drift into a generic white cat mascot.

### 03-style-notes.md

Use a text note to lock the rendering direction.

This note is responsible for:

- no 3D rendering
- no realistic fur texture
- no pixel-art conversion
- no hard toy plastic gloss
- no clay sculpture rendering
- allow soft simple shading only
- keep the look like a clean 2D mascot illustration with gentle volume

This is important because "not 3D" does not automatically mean "pixel art". We want a soft 2D mascot look instead.

### 04-alt-front.jpg

Optional.

Use another front-facing Catbbi image only if it supports the same silhouette and face design.

Good use:

- confirming forehead patch size
- confirming chest flower placement
- confirming face balance

Bad use:

- introducing conflicting proportions
- introducing different eye style

### 05-face-closeup.jpg

Optional but useful.

Use a close-up reference when the generated face is close but still not right.

This image is responsible for:

- eye spacing
- eye tilt
- muzzle balance
- eyebrow position
- beige patch boundaries

## Priority Order

If we can only use two references:

1. `01-identity-front.jpg`
2. `02-structure-breakdown.jpg`

If we can use more:

3. `03-style-notes.md`
4. `04-alt-front.jpg`
5. `05-face-closeup.jpg`

## How Each Reference Should Influence Generation

### Base Image

For the base image, priority should behave like this:

- identity-front: highest
- structure-breakdown: high
- style-notes: high
- optional extras: medium

The base image should first look like Catbbi, then stay clean and production-friendly.

### Row Generation

For animation rows:

- base image: highest
- identity-front: high
- structure-breakdown: high
- style-notes: high
- optional extras: repair support only

This keeps row generation loyal to Catbbi while still allowing clean motion.

## What To Avoid

Do not feed references that introduce the wrong finish:

- pixel-art versions as primary style anchor
- realistic plush toy photos
- 3D fan renders
- glossy figurine renders
- side view only images
- blurry screenshots
- fan edits with changed face proportions
- images with unrelated props dominating the design

## Practical Recommendation

For Catbbi's first real hatch run, the minimum correct pack is:

- `01-identity-front.jpg`
- `02-structure-breakdown.jpg`
- `03-style-notes.md`

This is enough to target the right visual branch.

## Next Step

Once these files are placed in `D:/pet/references/catbbi/`, we can prepare the first official `hatch-pet` run for Catbbi using the 2D mascot / soft flat desktop pet direction rather than the pixel-art branch.
