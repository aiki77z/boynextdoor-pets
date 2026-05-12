# Myngmyng Reference Pack Spec

## Purpose

This document defines the correct input reference pack for hatching Myngmyng / 明明 as a 2D desktop pet that matches the provided dog-wolf hybrid mascot style.

Target style:

- not 3D
- not realistic
- not pixel art as the final finish
- not plush photo realism
- not clay render
- soft, clean, flat 2D mascot feel
- slight soft shading is allowed
- should feel like an official-style chibi mascot turned into a moving desktop pet

The main goal is likeness to the provided Myngmyng image first, and animation production second.

## Main Principle

Myngmyng should be guided by three kinds of references:

1. identity reference
2. structure reference
3. style rule reference

If we want strong likeness, the identity image must lead the pack.

## Recommended Folder Layout

```text
D:/pet/
  references/
    myngmyng/
      01-identity-front.png
      02-structure-breakdown.jpg
      03-style-notes.md
      optional/
        04-alt-front.jpg
        05-face-closeup.jpg
```

## Reference Roles

### 01-identity-front.png

Use the clean front-facing Myngmyng image as the primary identity anchor.

This image is responsible for:

- exact head-to-body ratio
- wolf-dog head silhouette
- ear shape and placement
- face mood and expression
- fur color placement
- eye size, tilt, and spacing
- mouth shape and nose placement
- body proportions
- overall "this is Myngmyng" recognition

This is the single most important image in the pack.

### 02-structure-breakdown.jpg

Use the decomposition / breakdown image as the structural correction reference.

This image is responsible for:

- ear construction
- eye outline logic
- muzzle shape
- nose placement
- foot shape
- body contour
- face assembly logic

This image is used to stop drift into a generic dog mascot.

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

Use another front-facing Myngmyng image only if it supports the same silhouette and face design.

Good use:

- confirming ear shape
- confirming eye size
- confirming body proportion

Bad use:

- introducing conflicting proportions
- introducing different species cues

### 05-face-closeup.jpg

Optional but useful.

Use a close-up reference when the generated face is close but still not right.

This image is responsible for:

- eye spacing
- eye tilt
- muzzle balance
- eyebrow position
- nose shape

## Priority Order

If we can only use two references:

1. `01-identity-front.png`
2. `02-structure-breakdown.jpg`

If we can use more:

3. `03-style-notes.md`
4. `04-alt-front.jpg`
5. `05-face-closeup.jpg`

## What To Avoid

Do not feed references that introduce the wrong finish:

- pixel-art versions as the only style anchor
- realistic plush toy photos
- 3D fan renders
- glossy figurine renders
- blurry screenshots
- images with exaggerated expression that break the calm mascot identity

## Practical Recommendation

For Myngmyng's first real hatch run, the minimum correct pack is:

- `01-identity-front.png`
- `02-structure-breakdown.jpg`
- `03-style-notes.md`

This is enough to target the right visual branch.
