# Catbbi Asset Spec

## Goal

Turn Catbbi / 猫比 into the first production-ready hatch-pet sample for the BOYNEXTDOOR-inspired fan pet set. This file is the stable spec we can reuse when generating the base image, the nine standard animation rows, QA notes, and final packaging. The target branch is soft 2D mascot desktop pet, not pixel-art mode.

## Character Summary

Catbbi is a soft white cat pet with a shy but sweet presence. The appeal comes from contrast: sensitive expression, superstar aura, and a tiny hidden fitness obsession. The design should feel clean, cute, and a little precious, never loud or aggressive.

## Non-Negotiable Visual Anchors

1. Large milk-white cat head, much larger than the body.
2. Sharp pointed ears with orange tips.
3. Small orange patch centered on the top of the forehead.
4. Large black oval eyes with visible white rims.
5. Asymmetric beige face patches, left side stronger than right.
6. Tiny black nose and simple cat mouth.
7. Long thin whiskers extending far to both sides.
8. Tiny body with beige arms and flat beige feet.
9. Small orange clover-flower mark on the chest.

## Forbidden Drift

- no 3D look
- no plush rendering
- no pixel-art conversion
- no gradients
- no glossy highlights beyond tiny pixel eye shine if needed
- no realistic cat fur
- no human face
- no redesign into a round bear-like mascot
- no short whiskers
- no loss of white eye rims
- no oversized props that hide the body

## Row Intent

- `idle`: calm, tiny blink, almost no movement
- `waving`: reserved hello, one paw up
- `jumping`: shy happy bounce
- `sleeping`: compact curled sleep
- `review`: clicked/reacting pose, a little bashful
- `failed`: tiny exercise struggle, still cute
- `running-right`: careful quick steps right
- `running-left`: careful quick steps left
- `running`: busy in-place trot

## Suggested Run Notes

Use Catbbi as the visual benchmark pet for the whole set:

- thick outline consistency
- flat pixel fills
- compact silhouette
- strong face readability at tiny size
- restrained motion that matches a desktop companion

If Catbbi looks right, the other five pets should be normalized to the same production style.
