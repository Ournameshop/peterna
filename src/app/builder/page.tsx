// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Upload, Link as LinkIcon, ArrowRight, ArrowLeft, Check, X, Sparkles, Heart, Pencil, Play, Pause, Download, RotateCcw, ChevronRight, Image as ImageIcon, Music, Mic, Film, BookOpen, Sun, Moon, Home, Waves, Star, Cloud, Palette, Camera, Volume2, VolumeX as VolumeOff, Loader2 } from 'lucide-react';

// ============================================================================
// Peterna Tribute Builder â€” Interactive Prototype
// Mirrors the 10-stage Peternal skill journey, condensed into 8 user-facing steps
// Bone / espresso / brass palette Â· Cormorant Garamond + Inter
// ============================================================================

// Feature flag: when true, the builder talks to the real fal.ai-backed API routes.
// When false (default), keeps the original placeholder/simulation behavior.
// Set NEXT_PUBLIC_USE_FAL=true in the deployed .env to activate.
const USE_FAL = process.env.NEXT_PUBLIC_USE_FAL === 'true';

// TODO(fal): batch-generate the 16 static format/style tile previews via a build-time
// script that hits /api/image/generate once per tile and writes the URLs into a
// committed JSON map. Doing it per-render is wasteful and slow.

const PALETTE = {
  bone: '#F8F1E4',
  boneSoft: '#FBF6EC',
  parchment: '#E9D5C3',
  parchmentLight: '#E5DBC9',
  espresso: '#2A211B',
  espressoSoft: '#4A3F36',
  mute: '#7A6F66',
  brass: '#C9A961',
  brassDeep: '#A88841',
};

// ---- Library data, lifted from the skill -----------------------------------
const FORMATS = [
  {
    id: 'music_video', name: 'Music Video', desc: 'Beats cut to musical structure â€” dynamic, celebratory.', icon: Music, bestFor: [2,3],
    imagePrompt: "A cinematic photoreal film-strip aesthetic representing a music-video format pet tribute, 3:2 landscape. Five rectangular film frames in a horizontal sequence, each holding a different rhythmic moment of a sun-drenched dog at play: opening wide shot of a meadow with the dog small in frame, second frame a mid-energy run, third frame a high-energy mid-leap with motion blur, fourth frame a slow-motion suspension at peak joy, fifth frame a soft outro of the dog at rest catching breath in golden light. Frames have subtle 35mm sprocket holes top and bottom, soft film grain, warm cinematic color grade across all five panels â€” amber, gold, peach. The frames are connected as one continuous filmstrip on a soft cream paper background. Mood is musical, rhythmic, alive. NO text, NO words inside the frames or anywhere. Universal warm-toned dog silhouette, not breed-specific. Composition: filmstrip horizontal, slightly tilted ~3 degrees for energy. Color palette: warm amber, peach, cream paper backing, gold highlights, soft black sprocket holes. Avoid: identifiable breeds, modern objects, digital effects, harsh contrast, melancholy. Feel: the format's rhythm and joy made visible â€” five musical beats of love."
  },
  {
    id: 'biopic', name: 'Biopic', desc: 'A chronological life story, puppy to golden years.', icon: BookOpen, bestFor: [3,4],
    imagePrompt: "A cinematic photoreal storytelling image representing a chronological pet biopic, 3:2 landscape. A horizontal sequence of four soft vignettes blending into one another like film dissolves: leftmost shows a tiny puppy silhouette in spring grass with dandelions, second shows a young adult dog mid-run with longer legs in summer fields, third shows an adult dog at prime resting alert in golden afternoon light, fourth shows a senior gray-muzzled dog lying peacefully in late-autumn warmth with leaves drifting down. The four scenes blend with soft gradient transitions â€” spring green â†’ summer gold â†’ autumn amber â†’ winter cream. Each scene shares cinematic photoreal depth of field and warm 35mm grade. NO text, NO words, NO timestamps or year labels. Universal warm-toned dog silhouette, same gentle figure aged across four life stages. Mood is reverent, the passage of years made visible. Composition: horizontal four-act flow, eye reads left to right, each scene roughly equal size with subtle vignette darkening at edges. Color palette: spring sage, summer gold, autumn amber, soft winter cream, with consistent cream paper background tying them together. Avoid: identifiable breeds, harsh divisions between scenes, modern objects, anything clinical, hard outlines, digital-feeling. Feel: a whole life, gently traced."
  },
  {
    id: 'day_in_the_life', name: 'Day in the Life', desc: 'One perfect imagined day, gentle and present.', icon: Sun, bestFor: [2,3,4],
    imagePrompt: "A cinematic photoreal lifestyle image representing one perfect day in a beloved dog's life, 3:2 landscape. A horizontal sun-arc composition showing the same warm-toned dog at five points in a single day: morning stretch in a sunny doorway (lower-left), midday play in a backyard with a tennis ball (left-center), afternoon nap on a sunlit porch (center), evening walk in golden hour (right-center), nighttime curl-up on a bed with moonlight through window (lower-right). Above the scenes arcs a soft gradient sky â€” pink dawn â†’ blue midday â†’ golden afternoon â†’ orange dusk â†’ deep blue night â€” with a sun moving across and becoming a moon. The lower scenes are connected by a softly painted floor/landscape continuity. Photoreal cinematic warmth, soft DOF, painterly grade. NO text, NO words. Universal warm-toned dog silhouette, same dog repeated across five moments. Composition: arc above, scene row below, dog visible in each panel. Color palette: dawn pink, midday cerulean, gold, dusk orange, deep night blue, all with warm cream undertones. Avoid: identifiable breeds, modern technology, clutter, anything not domestic, harsh contrast, digital-feeling. Feel: a whole gentle day, distilled."
  },
  {
    id: 'letter', name: 'Letter to My Pet', desc: 'Voiceover-driven, each beat a line of the letter.', icon: Pencil, bestFor: [2,3],
    imagePrompt: "A cinematic photoreal intimate image representing a letter-to-my-pet tribute, 3:2 landscape. A close-up overhead view of an open handwritten letter on warm cream paper resting on a soft wooden tabletop, the letter softly out of focus and unreadable so no text is shown â€” just the impression of cursive writing in soft graphite or fountain pen ink. Beside the letter sits a small bowl of soft amber tea with steam rising, a pressed wildflower, and a slightly out-of-focus dog tag or small worn collar in the upper corner. Late-afternoon window light streams in from the right at a warm 4500K, creating a soft cinematic shadow play. Photoreal painterly grade, shallow depth of field, 50mm lens compression, warm 35mm film stock feel. Composition is intimate, overhead, slightly off-center for natural flow. NO actual readable text, NO recognizable words â€” the writing is impressionistic and abstract. Color palette: warm cream, ink-blue or sepia, amber tea, soft sage from the pressed flower, walnut wood tones. Mood is hushed, personal, devotional â€” the act of writing love down. Avoid: any readable letters or words, identifiable handwriting, modern objects, phones, screens, clinical lighting, sharp focus everywhere. Feel: a love letter being written in quiet afternoon light."
  },
  {
    id: 'greatest_hits', name: 'Their Greatest Hits', desc: 'A highlight reel of iconic moments.', icon: Sparkles, bestFor: [2,3],
    imagePrompt: "A cinematic photoreal collage representing a pet's greatest hits highlight reel, 3:2 landscape. A polaroid-photograph wall composition: six warm-toned snapshots arranged in a loose grid, slightly overlapping and tilted at gentle natural angles, pinned to a soft cream cork board or wall. Each polaroid frame shows a different iconic moment of the same universal warm-toned dog: one mid-leap catching a tennis ball, one curled in a sunbeam, one with head out a car window ears flying, one stealing a sock with mischievous joy, one cuddled on a couch beside an unseen owner, one running on a beach at sunset. Each photo has the slight color shift and warm cast of a real polaroid print, with white instant-film borders. Photoreal warmth, cinematic depth of field on the whole composition with the foreground polaroids in sharpest focus. NO text, NO captions, NO dates handwritten on the white borders â€” borders are blank cream. Universal warm-toned dog silhouette in every shot. Composition: hero polaroid in upper-center, others fanning around it organically. Color palette: warm polaroid amber, cream, soft sun gold, grass green, ocean teal, dusty rose, all unified by polaroid color shift. Mood is celebratory, joyful, deeply alive â€” a wall of best moments. Avoid: identifiable breeds, digital sharpness, modern phone photos, clinical lighting, any text or writing on photos. Feel: every moment that made them them."
  },
  {
    id: 'send_off', name: 'The Send-Off', desc: 'A ceremonial arc â€” journey, crossing, peace.', icon: Heart, bestFor: [3,4],
    imagePrompt: "A cinematic photoreal ceremonial image representing the send-off arc of a pet tribute, 3:2 landscape. A single sustained wide shot: a soft pastel cloudscape stretching across the frame at golden-hour pre-sunrise, with a warm gold path of light cutting diagonally from lower-left to upper-right, dissolving into bright soft haze at the horizon. A small warm-toned dog silhouette walks the path roughly two-thirds along, mid-stride, head slightly raised, ears forward â€” moving toward the light but unhurried, looking back over the shoulder with a final calm glance. The path is rendered as a soft glow rather than concrete ground â€” clouds and light blending into a journey. A faint rainbow arc curves across the upper third, barely visible like a watercolor wash. Reverent cinematic photoreal painterly grade, 85mm lens compression, soft cinematic depth of field with the dog in sharpest focus and the horizon dissolving in haze. NO text, NO words. Universal warm-toned dog silhouette. Composition: rule-of-thirds, dog at upper-right intersection, path leading from lower-left, horizon at upper-third. Color palette: warm peach, rose-gold, cream, soft lavender, pale amber, with one accent of warm white at the horizon. Mood is ceremonial, peaceful, transcendent â€” the dignified passage. Avoid: harsh light, dark colors, religious iconography, halos, wings, anything sentimental or kitsch, identifiable breeds, sadness. Feel: the dignified threshold â€” neither leaving nor arriving, just the crossing."
  },
  {
    id: 'postcards', name: 'Postcards From', desc: 'The pet "writes home" from where they are now.', icon: Star, bestFor: [2,3,4],
    imagePrompt: "A cinematic photoreal still life representing a postcards-from-my-pet tribute, 3:2 landscape. A flat-lay overhead view of a stack of vintage postcards scattered loosely on a soft cream linen surface, photoreal painterly grade, late-afternoon golden window light from upper-right casting soft long shadows. Four to five postcards are visible at gentle natural angles, each showing a different impossible idyllic place where the pet might be writing from: a sunlit beach with cliffs, a wildflower meadow at sunset, a soft cloudscape, a cozy fireside cabin, a snowy moonlit forest. The postcards are styled like classic 1960s travel postcards with rounded corners and warm color washes, but no readable text or place-name labels are visible â€” just the warm idyllic illustration on each. One postcard's reverse is visible showing impressionistic abstract handwriting in cursive (no readable words, no signature). A small dried flower, a worn travel stamp without text, and a delicate piece of cream ribbon are tucked among them. Shallow depth of field with the topmost postcard in sharpest focus, others softer. NO readable text anywhere, NO place names, NO words on stamps or postcards. Color palette: warm cream linen, amber postcard washes, dusty pink, sage, soft teal, gold ink. Mood is wistful, hopeful, gently magical â€” letters arriving from someplace beautiful. Avoid: readable writing, modern stamps, digital-feeling, identifiable specific locations, clutter, harsh shadows. Feel: postcards from somewhere kind."
  },
  {
    id: 'forever_young', name: 'Forever Young', desc: 'Imagined alternate timelines if they were still here.', icon: Cloud, bestFor: [3,4],
    imagePrompt: "A cinematic photoreal dreamlike image representing a forever-young tribute â€” imagined alternate scenes where the pet is still adventuring, 3:2 landscape. A soft layered composition with a slight dream-overlay feel: in the foreground a warm-toned dog mid-run through a wildflower field with golden hour light streaming, slightly out-of-focus translucent ghost-layers of the same dog at three other life moments overlaid like soft film double-exposures â€” one chasing a butterfly upper-left, one mid-leap toward the sky upper-right, one trotting away into haze along a path. Each ghost layer is at ~30% opacity, creating a feeling of all-possible-futures-at-once. Cinematic photoreal grade with a subtle ethereal lift, soft cinematic depth of field, golden warm color grade with one cool lavender accent for the dream-overlay quality. NO text, NO words. Universal warm-toned dog silhouette repeated across the four layers. Composition: foreground dog at lower-center-left mid-stride, ghost layers fanning upper-right, foreground field of wildflowers leading the eye in. Color palette: warm amber, gold, soft peach, with one accent of pale lavender for the ethereal layers, cream highlights. Mood is hopeful, imaginative, slightly dreamlike â€” what if they're still running. Avoid: identifiable breeds, sad or wistful expressions, dark colors, ghostly horror imagery, harsh edges between overlay layers, digital effects-feeling, clinical lighting. Feel: a parallel timeline where they never stopped running."
  },
];

const THEME_CATS = [
  { id: 'healing_and_peace', name: 'Healing & Peace', emoji: 'ðŸŒ…', desc: 'soft, hopeful, transcendent',
    themes: [
      {
        id: 'rainbow_bridge', name: 'Rainbow Bridge', desc: 'Soft cloudscapes, golden light, ethereal crossings.',
        gradient: 'linear-gradient(135deg, #F4D5B5 0%, #E9B888 40%, #C99A6E 100%)',
        imagePrompt: "A cinematic photoreal landscape painting of the Rainbow Bridge concept, 4:3 landscape. Soft pastel cloudscape stretching to infinity, golden hour light, a luminous rainbow arcing across the upper third with watercolor softness, warm peach and rose-gold horizon, gentle clouds with the cinematic depth of a Maxfield Parrish painting crossed with Terrence Malick cinematography. A pale soft path of golden light walks the eye into the haze. NO pets visible in this version â€” pure environment only. NO text. Color palette: warm peach, rose, cream, gold, pale lavender accent, soft white. Mood: transcendent, peaceful, the threshold. Avoid: religious iconography, halos, kitsch, harsh light, dark colors. Feel: an environment of soft arrival."
      },
      {
        id: 'sunrise_reunion', name: 'Sunrise Reunion', desc: 'Early-morning light, dew on grass, hopeful horizon.',
        gradient: 'linear-gradient(135deg, #F8DCC0 0%, #E8A985 50%, #B4715A 100%)',
        imagePrompt: "A cinematic photoreal landscape, 4:3 landscape. Early-morning sunrise breaking over a soft hillside meadow, first light cutting through low ground mist, dew-covered grass catching the warm rose-gold rays, the sun just clearing a soft horizon. A faint path leads through the meadow into the warm glow. The light is the hero. Style: the warm photoreal cinematography of a Days of Heaven sunrise crossed with the painterly grade of an Andrew Wyeth landscape. NO pets, NO people, NO text. Soft cinematic depth of field, 35mm lens, painterly warm grade. Color palette: dawn rose-gold, peach, pale amber, soft mint of dewy grass, with cream highlights and gentle warm shadows. Mood: hopeful renewal, the new day. Avoid: harsh contrast, dark colors, modern objects, anything urban or clinical. Feel: the world waking up warm."
      },
    ]},
  { id: 'quiet_grief', name: 'Quiet Grief', emoji: 'ðŸŒ™', desc: 'gentle melancholy, space to be sad',
    themes: [
      {
        id: 'gentle_rain', name: 'Gentle Rain', desc: 'Soft rain on windows, misty paths, muted light.',
        gradient: 'linear-gradient(135deg, #BCC3C8 0%, #8E9AA3 50%, #5C6770 100%)',
        imagePrompt: "A cinematic photoreal interior, 4:3 landscape. Close view of a rain-streaked window with soft warm interior light behind it, blurred lights of a peaceful neighborhood through the rain droplets, deep cinematic shallow depth of field â€” only a few rain droplets in sharpest focus while the rest dissolves into bokeh. A muted gray-blue palette with one warm accent of an interior glow. Style: the contemplative cinematography of Lost in Translation crossed with the muted palette of an Edward Hopper rainy-window study. NO pets, NO people, NO text. Soft 50mm macro lens feel, cinematic grade. Color palette: cool silver-blue, slate, dove gray, with one warm amber accent from interior light. Mood: gentle melancholy, space to feel sad, no forced positivity. Avoid: storms, harsh contrast, drama, scary atmosphere, bright colors. Feel: the room exhales with you."
      },
      {
        id: 'moonlight_vigil', name: 'Moonlight Vigil', desc: 'Soft moonlight, stars, quiet companionship.',
        gradient: 'linear-gradient(135deg, #5C6E8C 0%, #364159 50%, #1E2538 100%)',
        imagePrompt: "A cinematic photoreal nightscape, 4:3 landscape. A soft moonlit clearing with tall silhouetted trees framing the sides, the full moon high in a deep indigo sky scattered with quiet stars, soft cool blue moonlight illuminating a dew-covered meadow below, with one small warm amber glow in the lower-center â€” perhaps a single candle or lantern resting on the ground. Cinematic painterly photoreal grade, deep cool blue with surgical warm accents, the contrast that makes you feel held in the night. Style: the night cinematography of A Ghost Story crossed with the soft mythology of a Maxfield Parrish night scene. NO pets, NO people, NO text. Composition: rule-of-thirds, moon at upper-right, candle warmth at lower-third. Color palette: deep indigo, cool silver-blue, pale moon-cream, with one warm amber-orange accent. Mood: intimate, reflective, quiet companionship with the dark. Avoid: scary atmosphere, ghosts, harsh shadows, religious iconography. Feel: the night keeping vigil with you."
      },
    ]},
  { id: 'home_and_everyday_love', name: 'Home & Everyday Love', emoji: 'ðŸ›‹ï¸', desc: 'the warmth of ordinary moments',
    themes: [
      {
        id: 'quiet_home', name: 'Quiet Home', desc: 'Warm interiors, sunbeams on hardwood, soft light.',
        gradient: 'linear-gradient(135deg, #EBC891 0%, #C9994D 50%, #8C6328 100%)',
        imagePrompt: "A cinematic photoreal interior, 4:3 landscape. A warm sunlit living room captured in late-afternoon golden hour: a worn cream-colored couch with a soft folded blanket, sunbeams cutting diagonally across honey-toned hardwood floors, dust motes catching the light, a half-read book face-down on a side table, a ceramic mug, a single houseplant in the warm light. The room is empty of people but radiantly inhabited â€” the feel of the home you shared. Style: the warm domestic cinematography of Call Me By Your Name crossed with a Vermeer interior â€” light is the subject. Cinematic photoreal painterly grade, 35mm lens, soft DOF. NO pets, NO people, NO text. Color palette: warm honey, amber, cream, soft butter yellow, with one accent of sage from the houseplant. Mood: warm and lived-in, soft afternoon comfort. Avoid: modern minimalism, harsh light, electronics, anything clinical or staged. Feel: the home you shared at its quietest hour."
      },
      {
        id: 'beloved_places', name: 'Beloved Places', desc: 'The actual world they loved â€” yard, porch, park.',
        gradient: 'linear-gradient(135deg, #C9C28C 0%, #93915A 50%, #5A5734 100%)',
        imagePrompt: "A cinematic photoreal montage of a beloved everyday landscape, 4:3 landscape. A wide shot of a peaceful suburban backyard at late afternoon: a wooden fence line, a familiar patch of sun-warmed grass, an old garden hose coiled neatly, a beloved tennis ball half-tucked under a hedge, a porch step visible at the edge of frame with a worn doormat. The actual world of small daily joys made cinematic. Style: the photoreal warmth of a Sally Mann backyard photograph crossed with the cinematography of Boyhood â€” ordinary places elevated. Cinematic painterly grade, 35mm lens, soft cinematic DOF. NO pets, NO people, NO text. Color palette: warm grass green, soft amber late-light, weathered wood brown, with one accent of bright tennis-ball yellow. Mood: real, lived, deeply loved â€” the world they actually knew. Avoid: stylized or fantasy landscapes, anything not believably domestic, harsh light, modern dÃ©cor, clinical. Feel: the actual world they loved, made cinematic."
      },
    ]},
  { id: 'nature_and_freedom', name: 'Nature & Freedom', emoji: 'ðŸŒŠ', desc: 'open spaces, wind, release',
    themes: [
      {
        id: 'golden_meadow', name: 'Golden Meadow', desc: 'Sunlit fields, wildflowers, late-summer light.',
        gradient: 'linear-gradient(135deg, #E8C570 0%, #B69240 50%, #6A5520 100%)',
        imagePrompt: "A cinematic photoreal landscape, 4:3 landscape. A wide sunlit meadow at the height of late summer, tall golden grasses swaying gently with white-yellow wildflowers scattered throughout, an ancient single oak tree off-center providing soft compositional weight, warm late-afternoon amber sun streaming horizontally across the field creating long warm shadows and rim-lit grass blades. The kind of meadow you wandered into as a child. Style: the warm pastoral cinematography of Days of Heaven crossed with the Hudson River School painterly grandeur of an Albert Bierstadt golden field. Cinematic photoreal painterly grade, 35mm lens, generous cinematic depth of field. NO pets, NO people, NO text. Color palette: deep amber gold, warm honey, soft sage, cream highlights, with one accent of dusty pink wildflower. Mood: nostalgic, warm, the eternal late-summer afternoon. Avoid: harsh midday sun, modern objects, identifiable specific places, dark colors, anything urban. Feel: the meadow at the end of every perfect summer."
      },
      {
        id: 'endless_shore', name: 'Endless Shore', desc: 'Beach at sunset, pawprints, gentle waves.',
        gradient: 'linear-gradient(135deg, #F2C794 0%, #C28E5A 50%, #5D7B7E 100%)',
        imagePrompt: "A cinematic photoreal seascape, 4:3 landscape. A peaceful empty beach at sunset, gentle waves dissolving into wet sand, soft trail of small pawprints meandering from the lower-right corner toward the warm setting sun, fading naturally as they get closer to the water's edge. The horizon is wide open with a golden sun half-set, soft cinematic atmosphere with warm gold sky transitioning to soft teal water. Style: the contemplative seascape cinematography of The Tree of Life crossed with the soft palette of a Winslow Homer late-day painting. Cinematic photoreal painterly grade, 35mm lens, wide cinematic depth of field. NO pets visible â€” only the trace of pawprints. NO people, NO text. Color palette: warm gold, peach, soft amber sky, teal sea, wet-sand silver, cream highlights. Mood: peaceful goodbye, the open horizon, gentle release. Avoid: harsh waves, storms, dark colors, identifiable specific beaches, modern objects, drama. Feel: the trace of where they walked, the horizon ahead."
      },
    ]},
  { id: 'their_personality', name: 'Their Personality', emoji: 'ðŸŽ¾', desc: 'celebrate who they were',
    themes: [
      {
        id: 'forever_playful', name: 'Forever Playful', desc: 'Tennis balls, zoomies, mid-bounce joy.',
        gradient: 'linear-gradient(135deg, #F3CD79 0%, #D89A3B 50%, #8E5E1A 100%)',
        imagePrompt: "A cinematic photoreal still life, 4:3 landscape. A close-up overhead view of a bright yellow tennis ball captured mid-bounce just above sunlit green grass, motion blur softening its edges, a single blade of grass caught in mid-deflection beneath it, the warm midday sun creating crisp small shadow. The single object holds all the energy of every zoomie that ever happened. Style: the joyful object-photography of a Wes Anderson title card crossed with the painterly photorealism of a Carl Larsson everyday-scene watercolor. Cinematic photoreal painterly grade, 50mm macro lens, shallow cinematic DOF with the ball in sharpest focus. NO pets visible, NO people, NO text. Color palette: bright tennis yellow, warm grass green, soft sun-amber, cream highlights. Mood: pure aliveness made into a single still object, joyful energy. Avoid: identifiable brand markings on the tennis ball, modern context, harsh shadows, anything sad. Feel: a single tennis ball that contains an entire life of joy."
      },
      {
        id: 'nap_champion', name: 'Nap Champion', desc: 'Soft blankets, sleepy warmth, peaceful breathing.',
        gradient: 'linear-gradient(135deg, #EFD9B4 0%, #C9A077 50%, #876043 100%)',
        imagePrompt: "A cinematic photoreal interior still life, 4:3 landscape. A close intimate view of an empty soft cream blanket nest curled into the corner of a worn loved-in couch cushion, a small indent where a dog clearly slept many afternoons, late afternoon golden window light slanting across the soft fabric folds creating warm shadow play, a single dog hair catching the light. The absence of the dog is the subject. Style: the intimate domestic still life cinematography of a Sofia Coppola film crossed with the soft palette of a Carl Larsson interior. Cinematic photoreal painterly grade, 50mm lens, shallow DOF with the indent in sharpest focus. NO pets, NO people, NO text. Color palette: warm cream, soft butter, dusty rose, warm amber light, with one accent of sage. Mood: peaceful contentment, the warm trace of a beloved presence. Avoid: anything sad, harsh light, modern objects, clinical, sterile. Feel: the nest still holds their warmth."
      },
    ]},
  { id: 'spiritual_and_symbolic', name: 'Spiritual & Symbolic', emoji: 'ðŸŒŒ', desc: 'signs, stars, the unseen',
    themes: [
      {
        id: 'starlit_reunion', name: 'Starlit Reunion', desc: 'Celestial sky, gentle nebulas, cosmic companionship.',
        gradient: 'linear-gradient(135deg, #4A5380 0%, #2C2D52 50%, #14152D 100%)',
        imagePrompt: "A cinematic photoreal astrophotography image, 4:3 landscape. A deep indigo night sky scattered with thousands of soft stars and a faint warm-toned nebula spread across the upper-third, subtle wisps of gold and dusty rose nebular cloud. In the lower portion a faint silhouette of distant gentle hills, with a single small warm light somewhere on the horizon. The cosmos as gentle company. Style: the contemplative night cinematography of Tree of Life crossed with the soft astrophotography palette of a Hubble deep field but warmer and friendlier. Cinematic photoreal painterly grade, wide lens, deep cinematic clarity. NO pets, NO people, NO constellations resembling specific dogs, NO text. Color palette: deep indigo, cool midnight blue, with warm nebular accents of rose-gold, peach, soft amber, cream-white stars. Mood: cosmic companionship, the universe quietly present. Avoid: religious iconography, halos, ghostly imagery, recognizable constellations or shapes, harsh contrast, scary atmosphere. Feel: the stars keeping company with you."
      },
      {
        id: 'signs_and_symbols', name: 'Signs & Symbols', desc: 'Butterflies, feathers, dragonflies â€” the visits.',
        gradient: 'linear-gradient(135deg, #D4B89C 0%, #A88259 50%, #5E4528 100%)',
        imagePrompt: "A cinematic photoreal close-up still life, 4:3 landscape. A single soft white-and-cream feather drifting through warm afternoon light, suspended in air with a faint iridescent shimmer along its edge, soft dappled tree-canopy light dancing on the background as warm bokeh, a hint of butterfly wing in the upper-right corner just barely in frame. Soft slow-motion-feel even though it's a still. Style: the dreamy soft natural cinematography of Wong Kar-wai's daylight scenes crossed with the warmth of a Vilhelm HammershÃ¸i window-light study. Cinematic photoreal painterly grade, 85mm lens, very shallow cinematic DOF with the feather in sharpest focus and everything else dissolved. NO pets, NO people, NO text. Color palette: warm cream feather, soft amber dappled light, sage and dusty green bokeh, one accent of pale iridescent blue or violet. Mood: a gentle visit, the unseen made briefly visible. Avoid: heavy symbolism, religious iconography, ghosts, harsh light, clinical sharpness across the whole frame. Feel: the feather you find on the morning walk."
      },
    ]},
];

const STYLES = [
  {
    id: 'cinematic_realism', name: 'Cinematic Realism', emoji: 'ðŸŽ¬', desc: 'Soft photoreal, warm cinematic lighting.',
    imagePrompt: "A cinematic painterly photorealism portrait of a generic warm-toned dog, 1:1 square format. Three-quarter portrait, dog sitting upright in soft golden-hour light, eyes catching warm rim-light, fur showing photoreal texture and slight subsurface detail, gentle natural lighting from a soft window source, slight cinematic depth of field with background dissolved into warm bokeh. Style: the photoreal cinematography of Roger Deakins crossed with a warm Vermeer-style natural-light portrait. Painterly photoreal grade, 50mm lens, shallow DOF, reverent intimate framing. NO text, NO captions. Universal warm tan-and-cream dog â€” not breed-specific, gentle expressive face. Color palette: warm honey, amber, cream, soft brown, with one accent of warm light catching the iris. Mood: reverent, intimate, real â€” the way you actually saw them in the best afternoon light. Avoid: cartoonish features, painterly abstraction, identifiable breeds, harsh shadows, anything stylized away from photoreal."
  },
  {
    id: 'watercolor', name: 'Watercolor', emoji: 'ðŸŽ¨', desc: 'Bleeding pigments, soft brushwork, memorial-portrait warmth.',
    imagePrompt: "A soft watercolor painting portrait of a generic warm-toned dog, 1:1 square format. Three-quarter portrait of a gentle dog with soft pigment washes â€” visible bleeding edges where colors dissolve into warm cream paper, pigment pools settling at contours and fur lines, soft unpainted highlights where the paper shows through (especially on the chest, top of head, eye highlights), visible cold-press paper texture throughout the whole image. Pigments are loose, watery, and translucent â€” never solid or filled-in. Color palette: cream, soft rose, dusty ochre, warm sienna, with a faint dusty-teal accent in the shadow areas. Style: the memorial-portrait watercolor tradition of Andrew Wyeth's portrait sketches crossed with the soft pigment bleed of a Jenny Saville study. The painting feels hand-painted with a #4 round sable brush on Arches cold-press paper. NO text, NO signatures, NO captions. Universal warm-toned dog, gentle face, not breed-specific. Background is empty cream paper showing brushwork tests at the edges. Mood: deeply tender, hand-made, the oldest memorial form. Avoid: digital cleanness, hard outlines, vivid saturated colors, photoreal detail, identifiable breeds, decorative borders. Feel: a watercolor portrait you'd frame and keep forever."
  },
  {
    id: 'storybook_illustration', name: 'Storybook', emoji: 'âœï¸', desc: 'Hand-drawn children\u2019s-book warmth, painted softly.',
    imagePrompt: "A hand-drawn children's storybook illustration, 1:1 square format. A friendly warm-toned cartoon dog standing on a soft grassy hill with a small daisy patch at its feet, a sun overhead with hand-painted yellow rays, a single butterfly drifting in the upper-right corner. The art style is hand-painted with visible soft pencil construction lines beneath the paint, gouache or soft acrylic texture, gentle rounded shapes throughout, warm pastel palette, the slight printed-page warmth and texture of a vintage children's book. Style references: Beatrix Potter's tender warmth, Garth Williams' Charlotte's Web illustrations, Jon Klassen's restraint, Oliver Jeffers' painterly affection. The dog is universal â€” friendly rounded silhouette painted with affectionate simplicity, gentle smile, expressive black-dot eyes. NO text, NO words, NO page numbers. Color palette: warm cream paper tone, dusty sage green grass, soft amber dog, sun yellow, dusty pink daisy centers, gentle sky blue. Mood: timeless, picture-book warm â€” a Sunday-evening bedtime story page. Avoid: digital cleanness, sharp outlines, modern style, photoreal textures, anything edgy or contemporary, identifiable breeds. Feel: an illustration from a beloved childhood book."
  },
  {
    id: 'animated_3d', name: '3D Animated', emoji: 'ðŸ§¸', desc: 'Pixar warmth, soft volumes, expressive eyes.',
    imagePrompt: "A modern 3D animated film-style portrait of a generic warm-toned dog, 1:1 square format. Three-quarter portrait of a stylized dog with soft rounded volumes, large expressive eyes with multiple highlight catchlights, gentle subsurface scattering on fur tips making them glow in the warm light, soft fur grooming with directional flow, cinematic three-point lighting (key from upper-left, fill from front, rim from upper-right), warm color grade, slight cinematic depth of field. Style: the warm tradition of Pixar's character portraits crossed with the soft volumetric polish of Disney's modern animated features. Render quality is high-end feature-animation. NO text, NO captions, NO logos. Universal warm-toned dog with a gentle expressive smile and slightly tilted head, large soulful eyes â€” not breed-specific but reads as 'every good dog'. Background is a soft warm bokeh of indeterminate domestic context. Color palette: warm amber, gold, soft cream, deep chocolate accents in the eyes and nose, with one warm orange rim light. Mood: tender and emotive, the feel of a beloved animated film character right before a softly emotional moment. Avoid: photoreal textures, sharp realism, identifiable breeds, harsh lighting, anything cold or sterile. Feel: a feature-film character you'd already love by the second scene."
  },
  {
    id: 'claymation', name: 'Claymation', emoji: 'ðŸ¤', desc: 'Aardman-style hand-sculpted stop-motion.',
    imagePrompt: "A stop-motion claymation-style portrait of a generic warm-toned dog, 1:1 square format. A hand-sculpted plasticine clay dog sitting on a miniature tabletop diorama with a tiny patch of fabric grass and a small handmade wooden fence behind it. Visible thumbprints and tooling marks across the clay surface â€” the clay shows its handmade nature openly: slight imperfections in symmetry, soft tool marks in the fur sculpting, the seam where two clay colors meet. The clay is lit by soft warm tungsten studio light from upper-left, creating gentle shadows that hint at the table surface and ceiling of the diorama. The dog has clay-made eyes (small black plasticine balls with painted-on highlights) and a tiny clay tongue. Style: the warm tactile tradition of Aardman Animations (Wallace & Gromit) crossed with the Laika studio polish (Coraline, Kubo). The whole image feels like a still from a beloved stop-motion short film. NO text, NO captions. Universal warm-toned clay dog, friendly proportions, not breed-specific. Color palette: warm terracotta clay browns, soft tan, cream highlights, with one accent of green clay grass. Mood: handmade soulful intimacy, tactile warmth. Avoid: digital smoothness, photoreal textures, perfect symmetry, sharp clean lighting, identifiable breeds. Feel: someone built this dog with their hands, one careful afternoon."
  },
  {
    id: 'pencil_sketch', name: 'Pencil Sketch', emoji: 'ðŸ“', desc: 'Graphite on warm paper, the oldest memorial form.',
    imagePrompt: "A fine graphite pencil sketch portrait of a generic warm-toned dog, 1:1 square format. Three-quarter portrait drawn on warm cream paper with visible texture showing through. The drawing uses expressive line weight â€” heavier confident lines on the major contours and lighter feathered lines for fur direction. Visible cross-hatching for shading on the body and face shadows, feather-light shading on the lighter areas, soft smudged graphite highlights blended with a finger or tortillon, the slight grain of textured drawing paper showing through everywhere, occasional construction lines left visible to show the artist's process. Monochromatic â€” only graphite tones and the warm paper underneath, no color. Style: the memorial pencil-portrait tradition of a KÃ¤the Kollwitz portrait study crossed with the precision of a John Singer Sargent figure sketch. NO text, NO signatures (drawing only). Universal warm-toned dog, gentle expressive face, not breed-specific. Background is empty cream paper showing slight texture. The drawing fills about 70% of the frame, generous white space around. Color palette: graphite grays from soft silver to deep charcoal, on a warm cream paper that provides the only color. Mood: classical, restrained, the oldest form of memorial portrait. Avoid: any color flooding, painting, digital cleanness, sharp uniform lines, identifiable breeds, decorative borders. Feel: a graphite memorial sketch that has been in someone's home for decades."
  },
  {
    id: 'pixel_art', name: 'Pixel Art', emoji: 'ðŸŸª', desc: '16-bit retro warmth, joyful nostalgia.',
    imagePrompt: "A 16-bit pixel art portrait of a generic warm-toned dog, 1:1 square format, rendered with crisp pixel-perfect edges (NO anti-aliasing, NO smoothing). The dog is hand-pixeled with a clean readable silhouette â€” chunky satisfying pixels at roughly 64x64 resolution upscaled, dithered shading for volume on the body, the dog facing slightly right and sitting upright. Limited warm color palette of maybe 12-16 colors total: warm tan body, cream chest, deep brown nose and eye outlines, two small white eye-highlight pixels, soft pink tongue, with the background a soft warm sky gradient (peach to amber, dithered transition between bands), green grass strip along the bottom with hand-pixeled flower dots. A small sun in the upper-left corner made of yellow pixels with hand-placed rays. Style: the warm pixel-art tradition of Stardew Valley crossed with the sprite-craft of Owlboy or Celeste â€” affectionate, nostalgic, joyful. NO text, NO HUD elements, NO score displays. Universal warm-toned dog sprite, friendly rounded pixel shape, not breed-specific. Color palette: warm tans, cream, peach sky, dithered amber, grass green, hand-pixeled flowers in dusty pink. Mood: nostalgic, joyful, the affectionate way a long-loved game character is rendered. Avoid: smooth gradients, anti-aliased edges, digital-feeling rendering, photoreal textures, identifiable breeds, modern game UI. Feel: a sprite from a game you've played for years."
  },
  {
    id: 'voxel_minecraft', name: 'Voxel', emoji: 'ðŸ§Š', desc: 'Blocky world, friendly, especially fitting for kids.',
    imagePrompt: "A voxel block-art portrait of a generic warm-toned dog in the visual language of Minecraft, 1:1 square format. The dog is constructed from a small number of clean cubic voxel blocks â€” head, body, four legs, tail â€” sitting on a small platform of grass-block voxels with a few flower-block voxels nearby. Each block face is textured with a simple low-fi pixel texture (visible Minecraft-style noise pattern on each face). Soft ambient occlusion shading at block edges where blocks meet creating gentle realistic darkness in the seams. Warm gentle three-quarter top-down view, isometric-feel but slightly off-isometric for a friendly perspective. Soft warm yellow sun light from upper-left creating crisp clean block shadows. A few simple cloud-blocks in a soft pixel sky in the upper background. Style: pure Minecraft visual language â€” affectionate, blocky, instantly recognizable to any kid who plays â€” crossed with a slight handmade craftsiness. NO text, NO HUD elements, NO inventory UI, NO username tags. Universal warm-toned dog made of friendly chunky proportions (roughly 1 block head, 2 block body, 1 block legs), not breed-specific. Color palette: warm tan blocks, cream face, dark brown eye-blocks, green grass blocks, dirt brown underneath, soft sky blue, with one red flower-block accent. Mood: cheerful, approachable, family-friendly â€” the way a child memorial built in their favorite game would feel. Avoid: photoreal textures, smooth shading, anti-aliased edges, modern photoreal rendering, anything that breaks the block aesthetic, identifiable breeds. Feel: a tribute built block by block in the game a child loves."
  },
];

const CURATORS_PICKS = [
  {
    id: 'classic_send_off', name: 'The Classic Send-Off',
    format: 'send_off', theme: 'rainbow_bridge', style: 'cinematic_realism',
    tagline: 'A traditional, ceremonial goodbye.',
    // GPT Image 2 prompt â€” used to generate the hero card image
    imagePrompt: "A cinematic photorealistic memorial portrait, 4:3 landscape orientation. A soft golden-retriever silhouette stands at the threshold of a pastel cloudscape at sunrise, warm peach and rose-gold sky behind, soft diffuse golden hour light. A faint rainbow arcs across the upper-right corner. The dog is rendered with reverent realism â€” sun catches the rim of its fur in a halo, eyes closed peacefully, head slightly raised as if listening. Foreground is a meadow of pale wildflowers dissolving into soft mist. The mood is gentle, ceremonial, transcendent â€” like the final frame of a Terrence Malick film. Soft cinematic depth of field, painterly photoreal grade, warm 35mm film stock feel with delicate grain. NO text, NO words, NO captions, NO watermarks. Subject is universal â€” not breed-specific, gentle silhouette that could read as any beloved dog. Composition: rule of thirds with dog at lower-right, horizon at upper third, rainbow leading the eye. Color palette: warm peach, rose, soft gold, cream, with one accent of pale lavender. Avoid: harsh shadows, dark colors, anything sad or clinical, identifiable breeds, religious iconography, halos, wings. Feel: the moment just before crossing â€” peaceful arrival, not departure."
  },
  {
    id: 'joyful_celebration', name: 'Joyful Celebration',
    format: 'greatest_hits', theme: 'golden_meadow', style: 'cinematic_realism',
    tagline: 'Their best moments, sun-drenched and warm.',
    imagePrompt: "A cinematic photorealistic memorial image, 4:3 landscape orientation. A medium-sized dog mid-leap through a sunlit summer meadow at golden hour, ears flying, tongue out in pure joy, late-afternoon amber sun streaming through tall golden grasses. Wildflower petals and grass seeds suspended in the air like confetti, backlit by warm gold light. The dog is captured in motion freeze with a slight motion-blur on extremities â€” full aliveness, no stillness. Background dissolves into shallow cinematic bokeh of warm grasses and wildflowers. Mood is celebratory, sun-drenched, life-affirming â€” the visual feel of an Anthropologie summer campaign crossed with a Sundance documentary. Warm 35mm film grade, soft cinematic depth of field, golden-hour rim light along the dog's silhouette. NO text, NO words. Subject is universal â€” generic warm-toned dog, not breed-specific. Composition: dog centered or slight left-of-center, mid-air, with sun source at upper right creating lens flare. Color palette: amber, gold, warm green, cream, soft pink wildflowers. Avoid: sadness, clinical lighting, harsh shadows, urban backgrounds, modern objects, identifiable breeds, anything cold-toned. Feel: pure joyful aliveness â€” their happiest moment, frozen."
  },
  {
    id: 'quiet_goodbye', name: 'The Quiet Goodbye',
    format: 'letter', theme: 'quiet_home', style: 'watercolor',
    tagline: 'An intimate letter, in the home you shared.',
    imagePrompt: "A delicate watercolor painting, 4:3 landscape orientation. A small soft-edged dog curled asleep on a worn cream-colored couch in a sunlit living room, late-afternoon golden window light streaming across the scene from the right. Visible warm wooden floor, a soft folded blanket, a half-open book face-down on a cushion nearby, a ceramic mug with steam rising on a side table. The watercolor technique shows bleeding pigment edges, pigment pools settling at contours, soft unpainted highlights where the paper shows through, visible cold-press paper texture throughout. Color palette is muted and warm: cream, dusty rose, soft ochre, pale teal accent on the mug, soft amber light. The dog is universal in form â€” gentle silhouette, no breed-specific markings. Mood is intimate, hushed, deeply domestic â€” the quietest possible moment in a beloved home. Style references: Beatrix Potter's tender domesticity, Edward Gorey's restraint without his darkness, the soft palette of a Jenny Saville watercolor study. NO text, NO words, NO signatures. Composition: dog at lower center, window light source at upper right, soft compositional triangle from window through dog to foreground objects. Avoid: digital cleanness, hard outlines, vivid saturated colors, busy backgrounds, identifiable breeds, religious or sentimental icons, harsh shadows. Feel: the room exhales â€” peaceful afternoon nap in the home they loved most."
  },
  {
    id: 'storybook_for_them', name: 'A Storybook for Them',
    format: 'biopic', theme: 'beloved_places', style: 'storybook_illustration',
    tagline: 'Their life, painted like a beloved picture book.',
    imagePrompt: "A hand-drawn children's storybook illustration, 4:3 landscape orientation. A small warm-toned cartoon dog stands on a grassy hilltop overlooking a rolling pastoral landscape â€” a tiny cottage with a red door in the middle distance, soft round hills receding into hazy blue, a winding dirt path, a pair of trees with soft round canopies, a few sheep dots in the far meadow. The art style is hand-painted with visible soft pencil construction lines beneath the paint, gouache or soft acrylic texture, gentle rounded shapes throughout, warm pastel palette with the slight printed-page warmth of a vintage children's book. Style references: Beatrix Potter's pastoral tenderness, Garth Williams' Charlotte's Web illustrations, Jon Klassen's restraint, Oliver Jeffers' painterly warmth. The dog is universal â€” rounded friendly silhouette, not breed-specific, painted with affectionate simplicity. The sun is a soft yellow disc upper-left with a few faint hand-drawn rays. A few small painted wildflowers in the foreground grass. Mood is timeless, tender, picture-book warm â€” the kind of image that could be a Sunday-evening bedtime story page. NO text, NO words, NO page numbers. Composition: dog at center-left silhouetted against horizon, cottage at middle-right, foreground grass leading the eye in. Color palette: warm cream paper tone, dusty sage green, soft amber, dusty pink, gentle sky blue, brick red accent on cottage door. Avoid: digital cleanness, sharp outlines, modern style, photoreal textures, anything edgy or contemporary, identifiable breeds. Feel: a beloved picture-book illustration the family will turn back to for years."
  },
];

const TRAITS = ['Greeter at the door', 'Shadow at my feet', 'Class clown', 'Protector', 'Cuddle thief', 'Watchman', 'Wanderer', 'Wise old soul', 'Eternal puppy', 'Escape artist'];
const FAVORITES = ['Naps in sunbeams', 'Window watch', '4pm walk', 'Car rides', 'Favorite toy', 'Stealing socks', 'The beach', 'Snow days', 'Treats hidden everywhere', 'Backyard patrol'];

const LENGTHS = [
  { id: 2, name: '2 minutes', subtitle: '8 beats Â· short & sweet' },
  { id: 3, name: '3 minutes', subtitle: '12 beats Â· recommended' },
  { id: 4, name: '4 minutes', subtitle: '16 beats Â· full chapter' },
];

const ASPECTS = [
  { id: '9:16', name: 'Vertical', subtitle: 'phone-first', ratio: '9 / 16' },
  { id: '16:9', name: 'Horizontal', subtitle: 'TV & family viewing', ratio: '16 / 9' },
  { id: '1:1', name: 'Square', subtitle: 'social feeds', ratio: '1 / 1' },
];

// ---- Tiny UI primitives ----------------------------------------------------
const Serif = ({ children, style, italic, as = 'div', ...rest }) => {
  const Tag = as;
  return <Tag {...rest} style={{ fontFamily: '"Cormorant Garamond", Garamond, Georgia, serif', fontWeight: 400, fontStyle: italic ? 'italic' : 'normal', ...style }}>{children}</Tag>;
};
const Sans = ({ children, style, as = 'div', ...rest }) => {
  const Tag = as;
  return <Tag {...rest} style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', ...style }}>{children}</Tag>;
};
const Eyebrow = ({ children, color = PALETTE.brass }) => (
  <Sans style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color, fontWeight: 500 }}>{children}</Sans>
);
const PrimaryButton = ({ children, onClick, disabled, full, secondary, small }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      fontFamily: 'Inter, sans-serif',
      fontSize: small ? 13 : 14,
      letterSpacing: '0.02em',
      padding: small ? '8px 16px' : '14px 28px',
      border: secondary ? `1px solid ${PALETTE.espresso}` : 'none',
      background: disabled ? PALETTE.parchmentLight : (secondary ? 'transparent' : PALETTE.espresso),
      color: disabled ? PALETTE.mute : (secondary ? PALETTE.espresso : PALETTE.bone),
      cursor: disabled ? 'not-allowed' : 'pointer',
      borderRadius: 2,
      width: full ? '100%' : 'auto',
      transition: 'all 200ms ease',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}
    onMouseEnter={e => !disabled && (e.currentTarget.style.background = secondary ? PALETTE.espresso : PALETTE.brassDeep) && (secondary && (e.currentTarget.style.color = PALETTE.bone))}
    onMouseLeave={e => !disabled && (e.currentTarget.style.background = secondary ? 'transparent' : PALETTE.espresso) && (secondary && (e.currentTarget.style.color = PALETTE.espresso))}
  >
    {children}
  </button>
);

const Pill = ({ active, onClick, children, large }) => (
  <button
    onClick={onClick}
    style={{
      fontFamily: 'Inter, sans-serif',
      fontSize: large ? 14 : 13,
      padding: large ? '12px 22px' : '8px 16px',
      border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchment}`,
      background: active ? PALETTE.espresso : 'transparent',
      color: active ? PALETTE.bone : PALETTE.espresso,
      borderRadius: 999,
      cursor: 'pointer',
      transition: 'all 180ms ease',
      letterSpacing: '0.01em',
    }}
  >
    {children}
  </button>
);

// Sketch portrait placeholder â€” an SVG that nods to "pet" without committing to a real photo
const PetSketch = ({ size = 120, color = PALETTE.espresso, dim = false, species = 'dog' }) => {
  // Cat variant: pointier ears, slimmer face
  if (species === 'Cat') {
    return (
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ opacity: dim ? 0.35 : 0.85 }}>
        <ellipse cx="60" cy="76" rx="34" ry="30" fill="none" stroke={color} strokeWidth="1.4"/>
        <path d="M 32 56 L 38 32 L 50 50 Z" fill="none" stroke={color} strokeWidth="1.4"/>
        <path d="M 88 56 L 82 32 L 70 50 Z" fill="none" stroke={color} strokeWidth="1.4"/>
        <ellipse cx="50" cy="70" rx="2.5" ry="3.5" fill={color}/>
        <ellipse cx="70" cy="70" rx="2.5" ry="3.5" fill={color}/>
        <path d="M 58 80 L 62 80 L 60 83 Z" fill={color}/>
        <line x1="42" y1="80" x2="32" y2="78" stroke={color} strokeWidth="0.8"/>
        <line x1="42" y1="83" x2="32" y2="84" stroke={color} strokeWidth="0.8"/>
        <line x1="78" y1="80" x2="88" y2="78" stroke={color} strokeWidth="0.8"/>
        <line x1="78" y1="83" x2="88" y2="84" stroke={color} strokeWidth="0.8"/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ opacity: dim ? 0.35 : 0.85 }}>
      <ellipse cx="60" cy="78" rx="38" ry="32" fill="none" stroke={color} strokeWidth="1.4"/>
      <path d="M 30 58 Q 28 38 38 38 Q 44 38 44 50" fill="none" stroke={color} strokeWidth="1.4"/>
      <path d="M 90 58 Q 92 38 82 38 Q 76 38 76 50" fill="none" stroke={color} strokeWidth="1.4"/>
      <circle cx="50" cy="70" r="2.5" fill={color}/>
      <circle cx="70" cy="70" r="2.5" fill={color}/>
      <path d="M 56 82 Q 60 86 64 82" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <ellipse cx="60" cy="80" rx="3" ry="2" fill={color} opacity="0.6"/>
    </svg>
  );
};

// ----------------------------------------------------------------------------
// ART STYLE SWATCHES â€” distinct SVG previews communicating each visual language
// Each renders the same loose "pet on horizon" composition but in its style
// ----------------------------------------------------------------------------
const StyleSwatch = ({ styleId, width = '100%', height = 110 }) => {
  const W = 200, H = 130;
  const common = { viewBox: `0 0 ${W} ${H}`, width, height, preserveAspectRatio: 'xMidYMid slice', style: { display: 'block', borderRadius: 2 } };

  switch (styleId) {
    case 'cinematic_realism':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id="cr-sky" cx="0.6" cy="0.3" r="0.9">
              <stop offset="0%" stopColor="#F5D9A8"/>
              <stop offset="60%" stopColor="#C99668"/>
              <stop offset="100%" stopColor="#5A3826"/>
            </radialGradient>
            <linearGradient id="cr-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7A4D2E"/>
              <stop offset="100%" stopColor="#2E1B0F"/>
            </linearGradient>
            <filter id="cr-soft"><feGaussianBlur stdDeviation="0.4"/></filter>
          </defs>
          <rect width={W} height={H} fill="url(#cr-sky)"/>
          <rect y="86" width={W} height="44" fill="url(#cr-ground)"/>
          <ellipse cx="100" cy="92" rx="14" ry="3" fill="rgba(0,0,0,0.4)" filter="url(#cr-soft)"/>
          <g filter="url(#cr-soft)">
            <ellipse cx="100" cy="80" rx="13" ry="11" fill="#3A2818"/>
            <ellipse cx="100" cy="72" rx="9" ry="7.5" fill="#4A3220"/>
            <ellipse cx="96" cy="70" rx="1.4" ry="1.8" fill="#1A0E08"/>
            <ellipse cx="104" cy="70" rx="1.4" ry="1.8" fill="#1A0E08"/>
          </g>
          <rect width={W} height={H} fill="rgba(0,0,0,0.05)"/>
        </svg>
      );

    case 'watercolor':
      return (
        <svg {...common}>
          <defs>
            <filter id="wc-bleed" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3"/>
              <feDisplacementMap in="SourceGraphic" scale="3"/>
            </filter>
            <filter id="wc-paper">
              <feTurbulence baseFrequency="0.85" numOctaves="1"/>
              <feColorMatrix values="0 0 0 0 0.95  0 0 0 0 0.92  0 0 0 0 0.83  0 0 0 0.15 0"/>
            </filter>
          </defs>
          <rect width={W} height={H} fill="#FBF4E5"/>
          <rect width={W} height={H} filter="url(#wc-paper)"/>
          <g filter="url(#wc-bleed)" opacity="0.7">
            <ellipse cx="60" cy="50" rx="55" ry="22" fill="#E8B4B8"/>
            <ellipse cx="140" cy="40" rx="50" ry="18" fill="#D9A574"/>
          </g>
          <g filter="url(#wc-bleed)" opacity="0.55">
            <ellipse cx="100" cy="100" rx="80" ry="18" fill="#8FA67E"/>
          </g>
          <g filter="url(#wc-bleed)" opacity="0.75">
            <ellipse cx="100" cy="80" rx="13" ry="11" fill="#A87850"/>
            <ellipse cx="100" cy="72" rx="9" ry="7.5" fill="#C49169"/>
          </g>
          <ellipse cx="96" cy="71" r="1" fill="#3A2818"/>
          <ellipse cx="104" cy="71" r="1" fill="#3A2818"/>
        </svg>
      );

    case 'storybook_illustration':
      return (
        <svg {...common}>
          <defs>
            <pattern id="sb-paper" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="#FAEFD8"/>
              <circle cx="1" cy="1" r="0.3" fill="#E8D8B5" opacity="0.6"/>
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#sb-paper)"/>
          <path d="M 0 95 Q 40 88 100 92 T 200 90 L 200 130 L 0 130 Z" fill="#A8C982"/>
          <path d="M 0 100 Q 50 96 100 98 T 200 96 L 200 130 L 0 130 Z" fill="#8AB068"/>
          <g>
            {[30, 60, 90, 130, 165].map((x, i) => (
              <g key={i}>
                <circle cx={x} cy="98" r="2.2" fill="#F5D8E0"/>
                <circle cx={x} cy="96" r="0.8" fill="#FBF4E5"/>
              </g>
            ))}
          </g>
          <g stroke="#5C3A1F" strokeWidth="1.2" fill="#D89B6E" strokeLinejoin="round">
            <ellipse cx="100" cy="82" rx="14" ry="12"/>
            <ellipse cx="100" cy="73" rx="10" ry="8"/>
            <path d="M 89 68 Q 86 60 92 62 Q 94 65 94 70 Z"/>
            <path d="M 111 68 Q 114 60 108 62 Q 106 65 106 70 Z"/>
          </g>
          <circle cx="96" cy="73" r="1.4" fill="#2E1B0F"/>
          <circle cx="104" cy="73" r="1.4" fill="#2E1B0F"/>
          <circle cx="50" cy="22" r="9" fill="#F8D875"/>
        </svg>
      );

    case 'animated_3d':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id="a3-sky" cx="0.5" cy="0.4">
              <stop offset="0%" stopColor="#FFE9C2"/>
              <stop offset="100%" stopColor="#E0A875"/>
            </radialGradient>
            <radialGradient id="a3-body" cx="0.35" cy="0.3">
              <stop offset="0%" stopColor="#F4C896"/>
              <stop offset="60%" stopColor="#C58850"/>
              <stop offset="100%" stopColor="#6E3F1E"/>
            </radialGradient>
            <radialGradient id="a3-ground" cx="0.5" cy="0.0">
              <stop offset="0%" stopColor="#7BA85E"/>
              <stop offset="100%" stopColor="#4A6B38"/>
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#a3-sky)"/>
          <rect y="90" width={W} height="40" fill="url(#a3-ground)"/>
          <ellipse cx="100" cy="94" rx="18" ry="3" fill="rgba(0,0,0,0.3)"/>
          <ellipse cx="100" cy="80" rx="15" ry="13" fill="url(#a3-body)"/>
          <ellipse cx="100" cy="70" rx="11" ry="9" fill="url(#a3-body)"/>
          <ellipse cx="89" cy="62" rx="4" ry="6" fill="#6E3F1E"/>
          <ellipse cx="111" cy="62" rx="4" ry="6" fill="#6E3F1E"/>
          <ellipse cx="96" cy="69" rx="2.2" ry="2.8" fill="white"/>
          <ellipse cx="104" cy="69" rx="2.2" ry="2.8" fill="white"/>
          <circle cx="96" cy="70" r="1.4" fill="#0F0805"/>
          <circle cx="104" cy="70" r="1.4" fill="#0F0805"/>
          <circle cx="96.5" cy="69.4" r="0.5" fill="white"/>
          <circle cx="104.5" cy="69.4" r="0.5" fill="white"/>
        </svg>
      );

    case 'claymation':
      return (
        <svg {...common}>
          <defs>
            <filter id="cl-tex" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence baseFrequency="0.6" numOctaves="2" seed="2"/>
              <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/>
              <feComposite in2="SourceGraphic" operator="in"/>
            </filter>
            <radialGradient id="cl-bg" cx="0.5" cy="0.5">
              <stop offset="0%" stopColor="#E8C896"/>
              <stop offset="100%" stopColor="#7A5832"/>
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#cl-bg)"/>
          <ellipse cx="100" cy="115" rx="120" ry="12" fill="#5C3E22"/>
          <g>
            <ellipse cx="100" cy="80" rx="15" ry="12" fill="#B87B4E"/>
            <ellipse cx="100" cy="80" rx="15" ry="12" fill="white" filter="url(#cl-tex)"/>
            <ellipse cx="100" cy="71" rx="11" ry="9" fill="#C99060"/>
            <ellipse cx="100" cy="71" rx="11" ry="9" fill="white" filter="url(#cl-tex)"/>
            <ellipse cx="92" cy="62" rx="5" ry="7" fill="#9A6638"/>
            <ellipse cx="108" cy="62" rx="5" ry="7" fill="#9A6638"/>
            <circle cx="96" cy="70" r="1.6" fill="#1A0E08"/>
            <circle cx="104" cy="70" r="1.6" fill="#1A0E08"/>
            <ellipse cx="100" cy="76" rx="1.6" ry="1.2" fill="#3A1E10"/>
          </g>
          {[20, 50, 150, 180].map((x, i) => (
            <g key={i}>
              <ellipse cx={x} cy="100" rx="6" ry="3" fill="#7A5226"/>
              <ellipse cx={x} cy="100" rx="6" ry="3" fill="white" filter="url(#cl-tex)"/>
            </g>
          ))}
        </svg>
      );

    case 'pencil_sketch':
      return (
        <svg {...common}>
          <defs>
            <pattern id="ps-paper" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="#F4E8D0"/>
              <circle cx="1.5" cy="1.5" r="0.4" fill="#D6C5A1" opacity="0.4"/>
              <circle cx="3" cy="3" r="0.3" fill="#C8B58F" opacity="0.3"/>
            </pattern>
            <pattern id="ps-hatch" width="3" height="3" patternUnits="userSpaceOnUse">
              <line x1="0" y1="3" x2="3" y2="0" stroke="#3A2818" strokeWidth="0.4" opacity="0.6"/>
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#ps-paper)"/>
          <g stroke="#2E1B0F" fill="none" strokeWidth="0.8" strokeLinecap="round">
            <ellipse cx="100" cy="80" rx="14" ry="12"/>
            <ellipse cx="100" cy="80" rx="14" ry="12" fill="url(#ps-hatch)" opacity="0.5" stroke="none"/>
            <ellipse cx="100" cy="72" rx="10" ry="8"/>
            <path d="M 88 65 Q 86 58 92 60"/>
            <path d="M 112 65 Q 114 58 108 60"/>
            <circle cx="96" cy="71" r="1.2" fill="#2E1B0F"/>
            <circle cx="104" cy="71" r="1.2" fill="#2E1B0F"/>
            <path d="M 98 77 Q 100 79 102 77"/>
          </g>
          <g stroke="#2E1B0F" strokeWidth="0.5" opacity="0.4">
            <line x1="70" y1="96" x2="130" y2="96"/>
            <line x1="74" y1="98" x2="128" y2="98"/>
            <line x1="78" y1="100" x2="124" y2="100"/>
          </g>
        </svg>
      );

    case 'pixel_art':
      return (
        <svg {...common} shapeRendering="crispEdges">
          <rect width={W} height={H} fill="#8AC4D8"/>
          <rect y="78" width={W} height="52" fill="#6B9A4E"/>
          <rect y="86" width={W} height="44" fill="#588040"/>
          {/* pixel pet â€” chunky 8x8-ish */}
          {(() => {
            const px = 6; const ox = 84; const oy = 60;
            const grid = [
              '..xx....xx..',
              '.xddx..xddx.',
              'xdddxxxxddx',
              'xdwwddddwwx',
              'xdwwddddwwx',
              'xddddXXdddx',
              'xddddddddx.',
              '.xxxxxxxx..',
            ];
            const colors = { x: '#3A2818', d: '#C58850', w: '#FBF4E5', X: '#1A0E08' };
            return grid.flatMap((row, y) => [...row].map((ch, x) => {
              if (!colors[ch]) return null;
              return <rect key={`${x}-${y}`} x={ox + x * px} y={oy + y * px} width={px} height={px} fill={colors[ch]}/>;
            }));
          })()}
          {/* sun */}
          <rect x="20" y="14" width="14" height="14" fill="#F8D875"/>
          <rect x="22" y="12" width="10" height="2" fill="#F8D875"/>
          <rect x="22" y="28" width="10" height="2" fill="#F8D875"/>
          <rect x="34" y="16" width="2" height="10" fill="#F8D875"/>
          <rect x="18" y="16" width="2" height="10" fill="#F8D875"/>
        </svg>
      );

    case 'voxel_minecraft':
      return (
        <svg {...common} shapeRendering="crispEdges">
          <defs>
            <linearGradient id="vx-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A8D8F0"/>
              <stop offset="100%" stopColor="#D8E8F0"/>
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill="url(#vx-sky)"/>
          {/* grass blocks */}
          {Array.from({ length: 14 }).map((_, i) => (
            <g key={i}>
              <rect x={i * 15} y={88} width="15" height="6" fill="#5A8A3A"/>
              <rect x={i * 15} y={94} width="15" height="36" fill="#7A5232"/>
              <rect x={i * 15} y={94} width="15" height="2" fill="#8C6240"/>
              <rect x={i * 15} y={88} width="2" height="42" fill="rgba(0,0,0,0.15)"/>
            </g>
          ))}
          {/* voxel pet â€” face cube + body cube */}
          <g>
            <rect x="90" y="68" width="20" height="20" fill="#C58850"/>
            <rect x="90" y="68" width="20" height="2" fill="#D9A074"/>
            <rect x="108" y="68" width="2" height="20" fill="rgba(0,0,0,0.18)"/>
            <rect x="94" y="74" width="3" height="3" fill="#1A0E08"/>
            <rect x="103" y="74" width="3" height="3" fill="#1A0E08"/>
            <rect x="98" y="82" width="4" height="2" fill="#3A1E10"/>
            <rect x="86" y="64" width="6" height="6" fill="#A86F3E"/>
            <rect x="108" y="64" width="6" height="6" fill="#A86F3E"/>
            <rect x="84" y="86" width="32" height="4" fill="rgba(0,0,0,0.25)"/>
          </g>
          {/* cloud */}
          <rect x="30" y="20" width="30" height="8" fill="white"/>
          <rect x="36" y="14" width="18" height="6" fill="white"/>
        </svg>
      );

    default:
      return <svg {...common}><rect width={W} height={H} fill={PALETTE.parchment}/></svg>;
  }
};

// ----------------------------------------------------------------------------
// FORMAT THUMB â€” a tiny filmstrip that visually encodes the format's pacing
// ----------------------------------------------------------------------------
const FormatThumb = ({ formatId, width = '100%', height = 56 }) => {
  const W = 240, H = 60;
  const frame = (x, content, label) => (
    <g key={x}>
      <rect x={x} y="6" width="42" height="48" fill={PALETTE.boneSoft} stroke={PALETTE.parchment} strokeWidth="0.8"/>
      {content}
      {label && <text x={x + 21} y="50" fontSize="6" fill={PALETTE.mute} textAnchor="middle" fontFamily="Inter, sans-serif" letterSpacing="0.5">{label}</text>}
    </g>
  );
  const sprocket = (x) => <rect x={x} y="2" width="3" height="3" fill={PALETTE.parchment} rx="0.5"/>;
  const pet = (cx, cy, scale = 1) => (
    <g transform={`translate(${cx},${cy}) scale(${scale})`}>
      <ellipse cx="0" cy="2" rx="6" ry="5" fill={PALETTE.brassDeep}/>
      <ellipse cx="0" cy="-2" rx="4" ry="3.5" fill={PALETTE.brass}/>
      <circle cx="-1.5" cy="-2" r="0.6" fill={PALETTE.espresso}/>
      <circle cx="1.5" cy="-2" r="0.6" fill={PALETTE.espresso}/>
    </g>
  );

  const common = { viewBox: `0 0 ${W} ${H}`, width, height, style: { display: 'block' } };

  // Each format gets 5 frames showing its arc
  const configs = {
    music_video: { // dynamic, varying composition
      frames: [
        { content: pet(0, 8, 1.2), label: 'OPEN' },
        { content: pet(-8, 6, 1.4), label: 'BEAT' },
        { content: pet(8, 4, 0.9), label: 'DROP' },
        { content: pet(0, 8, 1.6), label: 'PEAK' },
        { content: pet(0, 10, 1), label: 'OUT' },
      ]
    },
    biopic: { // chronological â€” small to big
      frames: [
        { content: pet(0, 12, 0.6), label: 'PUP' },
        { content: pet(0, 10, 0.9), label: 'GROW' },
        { content: pet(0, 8, 1.2), label: 'PRIME' },
        { content: pet(0, 8, 1.1), label: 'GOLD' },
        { content: pet(0, 8, 1.0), label: 'TRIB' },
      ]
    },
    day_in_the_life: {
      frames: [
        { content: pet(0, 8, 1), label: 'MORN' },
        { content: pet(0, 8, 1), label: 'PLAY' },
        { content: pet(0, 8, 1), label: 'NOON' },
        { content: pet(0, 8, 1), label: 'EVE' },
        { content: pet(0, 8, 1), label: 'REST' },
      ]
    },
    letter: { // voiceover â€” text-forward
      frames: [
        { content: <g><line x1="6" y1="14" x2="36" y2="14" stroke={PALETTE.brassDeep} strokeWidth="1"/><line x1="6" y1="18" x2="32" y2="18" stroke={PALETTE.brassDeep} strokeWidth="1"/><line x1="6" y1="22" x2="36" y2="22" stroke={PALETTE.brassDeep} strokeWidth="1"/></g>, label: 'DEAR' },
        { content: <><line x1="6" y1="14" x2="36" y2="14" stroke={PALETTE.brassDeep} strokeWidth="1"/>{pet(21, 24, 0.7)}</>, label: 'I' },
        { content: <><line x1="6" y1="14" x2="32" y2="14" stroke={PALETTE.brassDeep} strokeWidth="1"/>{pet(21, 26, 0.6)}</>, label: 'YOU' },
        { content: <line x1="6" y1="30" x2="36" y2="30" stroke={PALETTE.brassDeep} strokeWidth="1"/>, label: 'OURS' },
        { content: <text x="27" y="34" fontSize="8" fill={PALETTE.brassDeep} fontFamily="Cormorant Garamond, serif" fontStyle="italic" textAnchor="middle">â€”</text>, label: 'LOVE' },
      ]
    },
    greatest_hits: {
      frames: [
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">â˜…</text></>, label: '01' },
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">â˜…</text></>, label: '02' },
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">â˜…</text></>, label: '03' },
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">â˜…</text></>, label: '04' },
        { content: <><circle cx="21" cy="20" r="3" fill={PALETTE.brass}/><text x="21" y="22" fontSize="5" fill="white" textAnchor="middle">â˜…</text></>, label: '05' },
      ]
    },
    send_off: { // ceremonial arc
      frames: [
        { content: pet(0, 10, 1), label: 'GATHER' },
        { content: pet(0, 8, 0.9), label: 'JOURNEY' },
        { content: <><line x1="6" y1="18" x2="36" y2="18" stroke={PALETTE.brass} strokeWidth="1.5" strokeDasharray="2 2"/>{pet(21, 24, 0.7)}</>, label: 'CROSS' },
        { content: pet(0, 8, 0.7), label: 'â†’' },
        { content: <circle cx="21" cy="18" r="6" fill={PALETTE.brass} opacity="0.4"/>, label: 'PEACE' },
      ]
    },
    postcards: {
      frames: [
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6"/>, label: '01' },
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6" transform="rotate(-4, 22, 20)"/>, label: '02' },
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6" transform="rotate(3, 22, 20)"/>, label: '03' },
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6" transform="rotate(-2, 22, 20)"/>, label: '04' },
        { content: <rect x="10" y="12" width="24" height="16" fill={PALETTE.boneSoft} stroke={PALETTE.brassDeep} strokeWidth="0.6"/>, label: 'XO' },
      ]
    },
    forever_young: {
      frames: [
        { content: pet(0, 6, 1.4), label: 'RUN' },
        { content: pet(0, 4, 1.3), label: 'LEAP' },
        { content: pet(0, 8, 1.0), label: 'NOW' },
        { content: pet(0, 8, 1.0), label: 'ALWAYS' },
        { content: pet(0, 6, 1.4), label: 'âˆž' },
      ]
    },
  };

  const cfg = configs[formatId] || configs.day_in_the_life;
  const frameWidth = 46;
  const startX = (W - cfg.frames.length * frameWidth) / 2;

  return (
    <svg {...common}>
      <rect width={W} height={H} fill={PALETTE.espresso}/>
      {/* top sprockets */}
      {Array.from({ length: 14 }).map((_, i) => sprocket(8 + i * 16))}
      {/* bottom sprockets */}
      {Array.from({ length: 14 }).map((_, i) => <rect key={i} x={8 + i * 16} y="55" width="3" height="3" fill={PALETTE.parchment} rx="0.5"/>)}
      {/* frames */}
      {cfg.frames.map((f, i) => {
        const x = startX + i * frameWidth;
        return (
          <g key={i} transform={`translate(${x - 2}, 0)`}>
            <g transform="translate(2, 0)">
              {frame(0, <g transform="translate(21, 22)">{f.content}</g>, f.label)}
            </g>
          </g>
        );
      })}
    </svg>
  );
};

// ----------------------------------------------------------------------------
// BEAT SCENE â€” varied per-beat composition so the storyboard doesn't look identical
// ----------------------------------------------------------------------------
const BeatScene = ({ beatIndex, themeGradient, aspect, species }) => {
  // 8 distinct compositions, indexed cyclically
  const compositions = [
    { petY: 70, petScale: 1.0, accents: 'sun' },       // centered, sun above
    { petY: 65, petScale: 0.85, accents: 'left' },     // upper-left vignette
    { petY: 75, petScale: 1.2, accents: 'close' },     // close-up
    { petY: 80, petScale: 0.6, accents: 'wide' },      // distant
    { petY: 70, petScale: 1.0, accents: 'particles' }, // particles
    { petY: 60, petScale: 0.9, accents: 'horizon' },   // high horizon
    { petY: 75, petScale: 1.1, accents: 'rim' },       // rim light
    { petY: 78, petScale: 0.8, accents: 'silhouette' },// silhouette
  ];
  const c = compositions[beatIndex % compositions.length];
  const aspectRatio = aspect === '9:16' ? '9 / 16' : aspect === '16:9' ? '16 / 9' : '1';

  return (
    <div style={{ aspectRatio, background: themeGradient || PALETTE.parchment, position: 'relative', overflow: 'hidden' }}>
      {c.accents === 'sun' && (
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.55)', filter: 'blur(4px)' }}/>
      )}
      {c.accents === 'horizon' && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '55%', height: 1, background: 'rgba(255,255,255,0.4)' }}/>
      )}
      {c.accents === 'particles' && (
        <>{[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ position: 'absolute', top: `${15 + i*9}%`, left: `${20 + (i%3)*25}%`, width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }}/>
        ))}</>
      )}
      {c.accents === 'rim' && (
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 40%, rgba(255,255,255,0.4), transparent 50%)' }}/>
      )}
      {c.accents === 'left' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.25), transparent 60%)' }}/>
      )}
      <div style={{ position: 'absolute', left: '50%', top: `${c.petY}%`, transform: `translate(-50%, -50%) scale(${c.petScale})` }}>
        <PetSketch size={70} color={c.accents === 'silhouette' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.88)'} species={species}/>
      </div>
      <div style={{ position: 'absolute', top: 8, left: 10, fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
        Beat {String(beatIndex + 1).padStart(2, '0')}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// WAVEFORM â€” small visual for music option cards
// ----------------------------------------------------------------------------
const Waveform = ({ pattern = 'piano', playing = false }) => {
  const patterns = {
    piano: [0.3, 0.7, 0.4, 0.9, 0.5, 0.8, 0.6, 0.3, 0.7, 0.4, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.3, 0.5, 0.7, 0.4],
    strings: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.8, 0.7, 0.6, 0.7, 0.8, 0.9, 0.7, 0.6, 0.5, 0.6, 0.7, 0.5, 0.4, 0.5],
    pads: [0.5, 0.55, 0.6, 0.58, 0.6, 0.62, 0.58, 0.6, 0.55, 0.58, 0.6, 0.62, 0.58, 0.55, 0.6, 0.58, 0.55, 0.5, 0.55, 0.5],
    silence: [0.08, 0.06, 0.1, 0.08, 0.06, 0.08, 0.1, 0.06, 0.08, 0.06, 0.1, 0.08, 0.06, 0.08, 0.1, 0.06, 0.08, 0.06, 0.1, 0.08],
  };
  const bars = patterns[pattern] || patterns.piano;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 22 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 2, height: `${h * 100}%`, background: PALETTE.brassDeep, borderRadius: 1,
          opacity: playing ? 1 : 0.6,
          animation: playing ? `wave-${i % 4} 1.4s ease-in-out infinite ${i * 60}ms` : 'none',
        }}/>
      ))}
      <style>{`
        @keyframes wave-0 { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.4); } }
        @keyframes wave-1 { 0%,100% { transform: scaleY(0.8); } 50% { transform: scaleY(1.2); } }
        @keyframes wave-2 { 0%,100% { transform: scaleY(1.2); } 50% { transform: scaleY(0.6); } }
        @keyframes wave-3 { 0%,100% { transform: scaleY(0.9); } 50% { transform: scaleY(1.3); } }
      `}</style>
    </div>
  );
};

// ---- Stages ----------------------------------------------------------------
const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'upload', label: 'Photos' },
  { id: 'pet', label: 'About them' },
  { id: 'character', label: 'Likeness' },
  { id: 'direction', label: 'Direction' },
  { id: 'words', label: 'Words & music' },
  { id: 'review', label: 'Review' },
  { id: 'generate', label: 'Tribute' },
];

// ============================================================================
// Main App
// ============================================================================
export default function PeternaPrototype() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    photos: [], // {id, name}
    petName: '',
    pronunciation: '',
    species: 'Dog',
    breed: 'Mixed breed',
    coat: 'Warm tan with a white blaze',
    age: 'Adult',
    gender: 'female',
    traits: [],
    favorites: [],
    length: 3,
    aspect: '9:16',
    pickType: 'curated', // 'curated' or 'custom'
    curatorsPick: null,
    format: null,
    themeCat: null,
    theme: null,
    style: null,
    opening: 'simple',
    closing: 'simple_farewell',
    music: 'piano_solo_01',
    narration: 'off',
    customWords: '',
  });

  // update() supports both merge patches and functional updates: pass an object to merge,
  // or a function (latestData) => partialPatch for race-safe in-flight mutations.
  const update = (patch) => setData(d => {
    const p = typeof patch === 'function' ? patch(d) : patch;
    return { ...d, ...(p || {}) };
  });
  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));
  const jumpTo = (i) => setStep(i);

  return (
    <div style={{ minHeight: '100vh', background: PALETTE.bone, color: PALETTE.espresso }}>
      <TopBar step={step} onJump={jumpTo} />
      <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 24px 96px' }}>
        {step === 0 && <Welcome onNext={next} />}
        {step === 1 && <PhotoUpload data={data} update={update} onNext={next} onBack={back} />}
        {step === 2 && <PetDetails data={data} update={update} onNext={next} onBack={back} />}
        {step === 3 && <CharacterSheet data={data} update={update} onNext={next} onBack={back} />}
        {step === 4 && <Direction data={data} update={update} onNext={next} onBack={back} />}
        {step === 5 && <WordsAndMusic data={data} update={update} onNext={next} onBack={back} />}
        {step === 6 && <ReviewBeats data={data} update={update} onNext={next} onBack={back} />}
        {step === 7 && <FinalTribute data={data} onRestart={() => { setData({ ...data, photos: [] }); setStep(0); }} />}
      </main>
    </div>
  );
}

// ============================================================================
// Top bar â€” brand + progress
// ============================================================================
function TopBar({ step, onJump }) {
  return (
    <header style={{ borderBottom: `1px solid ${PALETTE.parchmentLight}`, background: PALETTE.bone, position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(6px)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Serif style={{ fontSize: 24, letterSpacing: '-0.01em' }}>Peterna</Serif>
          <Sans style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: PALETTE.brass }}>Tribute Builder</Sans>
        </div>
        <ProgressDots step={step} onJump={onJump} />
      </div>
    </header>
  );
}

function ProgressDots({ step, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <button key={s.id} onClick={() => i <= step && onJump(i)} disabled={i > step}
            style={{ background: 'none', border: 'none', padding: '4px 2px', cursor: i <= step ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: active ? 28 : 8,
              height: 8,
              borderRadius: 4,
              background: active ? PALETTE.brass : (done ? PALETTE.espresso : PALETTE.parchmentLight),
              transition: 'all 250ms ease',
            }}/>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// STAGE 1 â€” Welcome (locked anti-trauma copy)
// ============================================================================
function Welcome({ onNext }) {
  const lines = [
    "I'm so glad you're here. Let's make something beautiful together.",
    "Before we begin â€” I won't ask you about their last day, or how they passed. If you ever want to share that, you can, but I'll never push for it.",
    "We'll go slowly, one question at a time. Every step is skippable. You can redo anything as many times as you need â€” there's no rush, and nothing here is permanent until you say it is.",
    "Ready when you are.",
  ];
  return (
    <section style={{ paddingTop: 48 }}>
      <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'left' }}>
        <Eyebrow>A gentle beginning</Eyebrow>
        <Serif as="h1" italic style={{ fontSize: 'clamp(40px, 5.5vw, 64px)', lineHeight: 1.05, marginTop: 18, color: PALETTE.espresso, letterSpacing: '-0.015em' }}>
          A tribute, made with care.
        </Serif>
        <div style={{ marginTop: 32, borderLeft: `2px solid ${PALETTE.brass}`, paddingLeft: 24 }}>
          {lines.map((line, i) => (
            <Serif key={i} style={{ fontSize: 22, lineHeight: 1.55, color: PALETTE.espressoSoft, marginBottom: 18, animation: `fadeUp 600ms ease ${i * 220}ms both` }}>
              {line}
            </Serif>
          ))}
        </div>
        <div style={{ marginTop: 40, animation: 'fadeUp 600ms ease 1200ms both' }}>
          <PrimaryButton onClick={onNext}>
            I'm ready <ArrowRight size={16} />
          </PrimaryButton>
          <Sans style={{ display: 'inline-block', marginLeft: 18, fontSize: 13, color: PALETTE.mute, fontStyle: 'italic' }}>
            takes about 8 minutes
          </Sans>
        </div>
      </div>
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </section>
  );
}

// ============================================================================
// STAGE 2 â€” Photo upload (file + URL combo)
// ============================================================================
function PhotoUpload({ data, update, onNext, onBack }) {
  const [url, setUrl] = useState('');
  const [drag, setDrag] = useState(false);
  const fileInputRef = useRef(null);

  // Background upload to fal.storage via /api/storage/upload. Fires when USE_FAL is true.
  // Race-safe: uses functional update() so concurrent uploads don't overwrite each other.
  const uploadPhotoInBackground = (photoId, file) => {
    if (!USE_FAL || !file) return;
    const fd = new FormData();
    fd.append('file', file);
    fetch('/api/storage/upload', { method: 'POST', body: fd })
      .then(async (r) => {
        const ct = r.headers.get('content-type') || '';
        const body = ct.includes('application/json') ? await r.json() : { error: await r.text() };
        if (!r.ok) throw new Error(body.error || `upload failed (${r.status})`);
        return body;
      })
      .then((body) => {
        update((latest) => ({
          photos: latest.photos.map((p) =>
            p.id === photoId ? { ...p, uploading: false, remoteUrl: body.url } : p
          ),
        }));
      })
      .catch((err) => {
        update((latest) => ({
          photos: latest.photos.map((p) =>
            p.id === photoId ? { ...p, uploading: false, uploadError: String((err && err.message) || err) } : p
          ),
        }));
      });
  };

  const addFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).filter(f => f && f.type && f.type.startsWith('image/'));
    if (incoming.length === 0) return;
    const mapped = incoming.map((f, idx) => ({
      id: Date.now() + Math.random() + idx,
      name: f.name || `photo_${data.photos.length + idx + 1}.jpg`,
      file: f,
      preview: URL.createObjectURL(f),
      size: f.size,
      uploading: USE_FAL ? true : false,
      remoteUrl: null,
      uploadError: null,
    }));
    update({ photos: [...data.photos, ...mapped] });
    // Kick off background uploads (no await, no block on Next button).
    if (USE_FAL) {
      mapped.forEach((m) => uploadPhotoInBackground(m.id, m.file));
    }
  };
  const openPicker = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };
  const onFilePicked = (e) => {
    addFiles(e.target.files);
    // reset so picking the same file again still fires onChange
    if (e.target) e.target.value = '';
  };
  const addUrl = () => {
    if (!url.trim()) return;
    update({ photos: [...data.photos, { id: Date.now(), name: url.split('/').pop() || 'linked-image', url }] });
    setUrl('');
  };
  const remove = (id) => {
    const target = data.photos.find(p => p.id === id);
    if (target && target.preview) {
      try { URL.revokeObjectURL(target.preview); } catch (_) { /* noop */ }
    }
    update({ photos: data.photos.filter(p => p.id !== id) });
  };

  return (
    <StageShell
      eyebrow="Step 1 of 7"
      title={<>Add some photos of <em>your pet</em>.</>}
      lede="A face shot, side profile, full body, anything that shows their personality. More angles help us capture their likeness more accurately."
      onNext={onNext} onBack={onBack} canNext={data.photos.length > 0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        onChange={onFilePicked}
        style={{ display: 'none' }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label="Add photos"
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer && e.dataTransfer.files); }}
        onClick={openPicker}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } }}
        style={{
          border: `1.5px dashed ${drag ? PALETTE.brass : PALETTE.parchment}`,
          background: drag ? 'rgba(201,169,97,0.06)' : PALETTE.boneSoft,
          padding: '48px 24px',
          textAlign: 'center',
          borderRadius: 4,
          transition: 'all 180ms ease',
          cursor: 'pointer',
        }}
      >
        <Upload size={28} color={PALETTE.brass} style={{ marginBottom: 12 }}/>
        <Serif style={{ fontSize: 22, color: PALETTE.espresso }}>Drag photos here</Serif>
        <Sans style={{ color: PALETTE.mute, fontSize: 13, marginTop: 6 }}>or click to browse — JPG, PNG, HEIC</Sans>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0' }}>
        <div style={{ flex: 1, height: 1, background: PALETTE.parchmentLight }}/>
        <Sans style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: PALETTE.mute }}>or paste a link</Sans>
        <div style={{ flex: 1, height: 1, background: PALETTE.parchmentLight }}/>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${PALETTE.parchment}`, borderRadius: 2, padding: '12px 14px', background: 'white' }}>
          <LinkIcon size={16} color={PALETTE.mute}/>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Google Drive, Dropbox, or direct link"
            style={{ border: 'none', outline: 'none', flex: 1, fontFamily: 'Inter, sans-serif', fontSize: 14, background: 'transparent', color: PALETTE.espresso }}/>
        </div>
        <PrimaryButton onClick={addUrl} secondary>Add</PrimaryButton>
      </div>

      {data.photos.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <Eyebrow>{data.photos.length} {data.photos.length === 1 ? 'photo' : 'photos'} added</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, marginTop: 12 }}>
            {data.photos.map((p, i) => (
              <div key={p.id} style={{ position: 'relative', aspectRatio: '1', background: `linear-gradient(135deg, ${PALETTE.parchment}, ${PALETTE.parchmentLight})`, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {p.preview || p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.preview || p.url} alt={p.name || 'pet photo'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <PetSketch size={56} color={PALETTE.espressoSoft} dim/>
                )}
                <button onClick={() => remove(p.id)} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(42,33,27,0.8)', color: PALETTE.bone, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={12}/>
                </button>
                {p.uploading && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'rgba(42,33,27,0.7)', color: PALETTE.bone, fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Loader2 size={10} style={{ animation: 'spin 1.2s linear infinite' }}/>
                    uploadingâ€¦
                  </div>
                )}
                {p.uploadError && (
                  <div title={p.uploadError} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'rgba(150,40,40,0.8)', color: PALETTE.bone, fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    upload failed
                  </div>
                )}
              </div>
            ))}
          </div>
          {data.photos.length === 1 && (
            <Serif italic style={{ marginTop: 18, color: PALETTE.mute, fontSize: 16 }}>
              If you have any more from a different angle, they'll help us capture them more accurately. If this is the only one, that's completely OK.
            </Serif>
          )}
        </div>
      )}
    </StageShell>
  );
}

// ============================================================================
// STAGE 3 â€” Pet details (name, traits, favorites)
// ============================================================================
function PetDetails({ data, update, onNext, onBack }) {
  const toggleTrait = (t) => {
    const traits = data.traits.includes(t) ? data.traits.filter(x => x !== t) : (data.traits.length >= 3 ? data.traits : [...data.traits, t]);
    update({ traits });
  };
  const toggleFav = (f) => {
    const favorites = data.favorites.includes(f) ? data.favorites.filter(x => x !== f) : (data.favorites.length >= 5 ? data.favorites : [...data.favorites, f]);
    update({ favorites });
  };

  return (
    <StageShell
      eyebrow="Step 2 of 7"
      title={<>Tell us about <em>them</em>.</>}
      lede="Just enough so we get the details right. Anything you'd rather skip, skip."
      onNext={onNext} onBack={onBack} canNext={!!data.petName.trim()}
    >
      <FieldGroup label="What was their name?">
        <input value={data.petName} onChange={e => update({ petName: e.target.value })} placeholder="e.g. Toby, Mango, Pepper"
          style={{
            width: '100%', border: 'none', borderBottom: `1px solid ${PALETTE.parchment}`, outline: 'none', padding: '12px 0',
            fontFamily: '"Cormorant Garamond", serif', fontSize: 32, fontStyle: 'italic', color: PALETTE.espresso, background: 'transparent',
          }}/>
      </FieldGroup>

      <FieldGroup label="They were aâ€¦" hint="optional">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Dog', 'Cat', 'Rabbit', 'Bird', 'Other'].map(s => (
            <Pill key={s} active={data.species === s} onClick={() => update({ species: s })}>{s}</Pill>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="Pronouns">
        <div style={{ display: 'flex', gap: 8 }}>
          {[['female', 'she / her'], ['male', 'he / him'], ['neutral', 'they / them']].map(([g, label]) => (
            <Pill key={g} active={data.gender === g} onClick={() => update({ gender: g })}>{label}</Pill>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label={`What were ${data.petName || 'they'} like?`} hint={`pick up to 3 Â· ${data.traits.length}/3`}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TRAITS.map(t => (
            <Pill key={t} active={data.traits.includes(t)} onClick={() => toggleTrait(t)}>{t}</Pill>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="What did they love?" hint={`pick up to 5 Â· ${data.favorites.length}/5`}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FAVORITES.map(f => (
            <Pill key={f} active={data.favorites.includes(f)} onClick={() => toggleFav(f)}>{f}</Pill>
          ))}
        </div>
      </FieldGroup>
    </StageShell>
  );
}

// ============================================================================
// STAGE 4 â€” Character sheet (likeness gate)
// ============================================================================
function CharacterSheet({ data, update, onNext, onBack }) {
  const [generating, setGenerating] = useState(true);
  const [frames, setFrames] = useState(null); // null = not yet, [] = empty, [{url, view}, ...]
  const [genError, setGenError] = useState(null);
  const [rerollCount, setRerollCount] = useState(0);

  const firstRemoteUrl = (data.photos || []).map((p) => p.remoteUrl).find(Boolean);

  useEffect(() => {
    let cancelled = false;

    if (!USE_FAL || !firstRemoteUrl) {
      // Original placeholder behavior: pretend to render for 2.4s then show sketches.
      setFrames(null);
      setGenError(null);
      setGenerating(true);
      const t = setTimeout(() => { if (!cancelled) setGenerating(false); }, 2400);
      return () => { cancelled = true; clearTimeout(t); };
    }

    // Real path: hit /api/video/character-sheet with the first uploaded photo.
    setGenerating(true);
    setGenError(null);
    setFrames(null);

    const styleObj = STYLES.find((s) => s.id === data.style);
    const styleDirective = styleObj
      ? `${styleObj.name} â€” ${styleObj.desc}`
      : 'cinematic photoreal painterly grade, warm 35mm film stock';

    fetch('/api/video/character-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        petPhotoUrl: firstRemoteUrl,
        styleDirective,
        petName: data.petName,
      }),
    })
      .then(async (r) => {
        const ct = r.headers.get('content-type') || '';
        const body = ct.includes('application/json') ? await r.json() : { error: await r.text() };
        if (!r.ok) throw new Error(body.error || `character-sheet failed (${r.status})`);
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        const f = Array.isArray(body && body.frames) ? body.frames : [];
        setFrames(f);
        setGenerating(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setGenError(String((err && err.message) || err));
        setGenerating(false);
      });

    return () => { cancelled = true; };
  }, [USE_FAL && firstRemoteUrl, rerollCount, data.style, data.petName]);

  return (
    <StageShell
      eyebrow="Step 3 of 7 Â· Likeness check"
      title={<>Does this look like <em>{data.petName || 'your pet'}</em>?</>}
      lede="We render four reference views to lock in their likeness before anything else is made. Reroll as many times as you need â€” this part has to feel right."
      onNext={onNext} onBack={onBack} canNext={!generating}
      nextLabel="Yes, this is them"
      secondaryAction={!generating && (
        <button onClick={() => {
          if (USE_FAL && firstRemoteUrl) {
            setRerollCount((n) => n + 1);
          } else {
            setGenerating(true);
            setTimeout(() => setGenerating(false), 1600);
          }
        }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: PALETTE.brassDeep, fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4 }}>
          <RotateCcw size={13}/> reroll
        </button>
      )}
    >
      {genError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
          <Sans style={{ fontSize: 13, color: PALETTE.espressoSoft }}>
            We couldnâ€™t generate previews right now â€” showing placeholders. You can still continue, or hit reroll to try again.
          </Sans>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {['Front', 'Side profile', 'Full body', 'Looking up'].map((view, i) => {
          const frame = frames && frames[i];
          const frameUrl = frame && frame.url;
          return (
          <div key={view} style={{
            aspectRatio: '1',
            background: PALETTE.boneSoft,
            border: `1px solid ${PALETTE.parchmentLight}`,
            borderRadius: 4,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {generating ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Loader2 size={20} color={PALETTE.brass} style={{ animation: 'spin 1.2s linear infinite' }}/>
                <Sans style={{ fontSize: 11, color: PALETTE.mute, letterSpacing: '0.1em', textTransform: 'uppercase' }}>renderingâ€¦</Sans>
              </div>
            ) : frameUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frameUrl} alt={`${data.petName || 'pet'} â€” ${view}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}/>
                <Sans style={{ position: 'absolute', bottom: 10, left: 12, fontSize: 11, color: PALETTE.bone, letterSpacing: '0.12em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{view}</Sans>
              </>
            ) : (
              <>
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 60%, ${PALETTE.parchment}, ${PALETTE.boneSoft})` }}/>
                <PetSketch size={120} color={PALETTE.espresso} species={data.species}/>
                <Sans style={{ position: 'absolute', bottom: 10, left: 12, fontSize: 11, color: PALETTE.mute, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{view}</Sans>
              </>
            )}
          </div>
        );})}
      </div>

      {!generating && (
        <div style={{ marginTop: 28, padding: '20px 22px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
          <Eyebrow>What we observed</Eyebrow>
          <Serif italic style={{ fontSize: 18, color: PALETTE.espressoSoft, marginTop: 8, lineHeight: 1.5 }}>
            {data.petName || 'Your pet'} looks like a {data.coat.toLowerCase()} {data.species.toLowerCase()} â€” {data.age.toLowerCase()}, gentle eyes, soft soulful presence.
          </Serif>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {[`Species: ${data.species}`, `Breed: ${data.breed}`, `Coat: ${data.coat}`, `Age: ${data.age}`].map(chip => (
              <button key={chip} style={{
                fontFamily: 'Inter, sans-serif', fontSize: 12, padding: '6px 12px', background: 'white', border: `1px solid ${PALETTE.parchment}`, borderRadius: 999,
                color: PALETTE.espressoSoft, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                {chip} <Pencil size={10} color={PALETTE.mute}/>
              </button>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </StageShell>
  );
}

// ============================================================================
// STAGE 5 â€” Direction (Curator's Picks OR Custom: format/theme/style)
// ============================================================================
function Direction({ data, update, onNext, onBack }) {
  const [path, setPath] = useState(data.curatorsPick ? 'curated' : (data.format ? 'custom' : null));
  const [subStep, setSubStep] = useState(0); // for custom: 0=format, 1=theme cat, 2=theme, 3=style

  if (!path) {
    return (
      <StageShell
        eyebrow="Step 4 of 7 Â· The direction"
        title={<>How would you like this to <em>feel</em>?</>}
        lede="Two ways to begin. Either is right. You can change anything later."
        onNext={() => {}} onBack={onBack} canNext={false}
        hideNext
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <PathCard
            title="Curator's Picks"
            tagline="Four hand-built starting points. The fastest path."
            icon={<Sparkles size={20}/>}
            onClick={() => setPath('curated')}
            accent
          />
          <PathCard
            title="Build it myself"
            tagline="Pick the format, theme, and visual style. Takes a few more minutes."
            icon={<Palette size={20}/>}
            onClick={() => { setPath('custom'); update({ pickType: 'custom', curatorsPick: null }); }}
          />
        </div>
      </StageShell>
    );
  }

  if (path === 'curated') {
    return (
      <StageShell
        eyebrow="Step 4 of 7 Â· Curator's picks"
        title={<>Four <em>starting points</em>.</>}
        lede="Each one is a complete combination of format, world, and art style. Tap one to see it â€” you can switch the art style on the next screen if you'd like."
        onNext={onNext} onBack={() => setPath(null)} canNext={!!data.curatorsPick}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {CURATORS_PICKS.map(pick => {
            const active = data.curatorsPick === pick.id;
            const themeObj = THEME_CATS.flatMap(c => c.themes).find(t => t.id === pick.theme);
            return (
              <button key={pick.id} onClick={() => update({ curatorsPick: pick.id, format: pick.format, theme: pick.theme, style: pick.style, pickType: 'curated' })}
                style={{
                  textAlign: 'left', padding: 0, border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`, background: 'white', borderRadius: 4, cursor: 'pointer', overflow: 'hidden',
                  transition: 'all 200ms ease', transform: active ? 'translateY(-2px)' : 'none', boxShadow: active ? '0 8px 32px rgba(42,33,27,0.08)' : 'none',
                }}>
                <div style={{ position: 'relative', overflow: 'hidden', height: 140 }}>
                  {/* IMAGE-PROMPT-SITE: curators-pick-hero.
                      Replace this conditional with the GPT Image 2 generated asset.
                      Prompt source: CURATORS_PICKS[pick.id].imagePrompt
                      Render at 1200x900 (4:3), high quality, PNG. */}
                  {pick.imageUrl ? (
                    <img src={pick.imageUrl} alt={pick.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
                  ) : (
                    <StyleSwatch styleId={pick.style} height={140}/>
                  )}
                  <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.95)', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                    {STYLES.find(s => s.id === pick.style)?.name}
                  </div>
                  {active && (
                    <div style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', background: PALETTE.espresso, color: PALETTE.bone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14}/>
                    </div>
                  )}
                </div>
                <div style={{ padding: '18px 20px' }}>
                  <Serif style={{ fontSize: 24, color: PALETTE.espresso, lineHeight: 1.1 }}>{pick.name}</Serif>
                  <Serif italic style={{ fontSize: 15, color: PALETTE.mute, marginTop: 6, lineHeight: 1.4 }}>{pick.tagline}</Serif>
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <Tag>{FORMATS.find(f => f.id === pick.format)?.name}</Tag>
                    <Tag>{themeObj?.name}</Tag>
                    <Tag>{STYLES.find(s => s.id === pick.style)?.name}</Tag>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </StageShell>
    );
  }

  // Custom path: format â†’ theme category â†’ theme â†’ style
  const totalSubs = 4;
  return (
    <StageShell
      eyebrow={`Step 4 of 7 Â· Build Â· ${subStep + 1} of ${totalSubs}`}
      title={[<>What <em>format</em>?</>, <>What <em>world</em>?</>, <>Which <em>theme</em>?</>, <>What <em>art style</em>?</>][subStep]}
      lede={['Eight ways to shape the story.', 'Six emotional registers â€” pick the one that fits.', 'Two worlds inside this register.', 'Eight visual languages â€” same story, different feeling.'][subStep]}
      onNext={() => {
        if (subStep < totalSubs - 1) setSubStep(subStep + 1);
        else onNext();
      }}
      onBack={() => {
        if (subStep === 0) setPath(null);
        else setSubStep(subStep - 1);
      }}
      canNext={[data.format, data.themeCat, data.theme, data.style][subStep]}
    >
      {subStep === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {FORMATS.map(f => {
            const active = data.format === f.id;
            const Icon = f.icon;
            return (
              <button key={f.id} onClick={() => update({ format: f.id })}
                style={{
                  padding: 0, border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: 'white', cursor: 'pointer', borderRadius: 4, overflow: 'hidden', textAlign: 'left',
                  transition: 'all 180ms ease',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.brass; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.parchmentLight; }}>
                {/* IMAGE-PROMPT-SITE: format-thumb.
                    Replace with GPT Image 2 generated still.
                    Prompt source: FORMATS[f.id].imagePrompt
                    Render at 720x480 (3:2), medium quality, JPEG. */}
                {f.imageUrl ? (
                  <img src={f.imageUrl} alt={f.name} style={{ width: '100%', height: 60, objectFit: 'cover', display: 'block' }}/>
                ) : (
                  <FormatThumb formatId={f.id} height={60}/>
                )}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={15} color={PALETTE.brassDeep}/>
                    <Serif style={{ fontSize: 18 }}>{f.name}</Serif>
                    {active && <Check size={13} color={PALETTE.espresso} style={{ marginLeft: 'auto' }}/>}
                  </div>
                  <Serif italic style={{ fontSize: 13, color: PALETTE.mute, marginTop: 4, lineHeight: 1.4 }}>{f.desc}</Serif>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {subStep === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {THEME_CATS.map(cat => (
            <ChoiceCard key={cat.id} active={data.themeCat === cat.id} onClick={() => update({ themeCat: cat.id, theme: null })}
              emoji={cat.emoji} title={cat.name} desc={cat.desc}/>
          ))}
        </div>
      )}
      {subStep === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {(THEME_CATS.find(c => c.id === data.themeCat)?.themes || []).map(t => {
            const active = data.theme === t.id;
            return (
              <button key={t.id} onClick={() => update({ theme: t.id })}
                style={{ padding: 0, border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`, background: 'white', borderRadius: 4, cursor: 'pointer', overflow: 'hidden', textAlign: 'left' }}>
                {/* IMAGE-PROMPT-SITE: theme-hero.
                    Replace gradient with the GPT Image 2 generated asset.
                    Prompt source: THEME_CATS[].themes[].imagePrompt
                    Render at 1200x900 (4:3), high quality, PNG. */}
                <div style={{ height: 140, background: t.imageUrl ? `url("${t.imageUrl}") center/cover no-repeat` : t.gradient, position: 'relative' }}>
                  {active && (
                    <div style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', background: PALETTE.espresso, color: PALETTE.bone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14}/>
                    </div>
                  )}
                </div>
                <div style={{ padding: '16px 18px' }}>
                  <Serif style={{ fontSize: 22 }}>{t.name}</Serif>
                  <Serif italic style={{ fontSize: 14, color: PALETTE.mute, marginTop: 4, lineHeight: 1.4 }}>{t.desc}</Serif>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {subStep === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {STYLES.map(s => {
            const active = data.style === s.id;
            return (
              <button key={s.id} onClick={() => update({ style: s.id })}
                style={{
                  padding: 0, border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: 'white', cursor: 'pointer', borderRadius: 4, overflow: 'hidden', textAlign: 'left',
                  transition: 'all 180ms ease', transform: active ? 'translateY(-2px)' : 'none',
                  boxShadow: active ? '0 8px 24px rgba(42,33,27,0.08)' : 'none',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.brass; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.parchmentLight; }}>
                <div style={{ position: 'relative' }}>
                  {/* IMAGE-PROMPT-SITE: style-thumb.
                      Replace with GPT Image 2 generated sample in this exact art style.
                      Prompt source: STYLES[s.id].imagePrompt
                      Render at 600x600 (1:1), medium quality, PNG. */}
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}/>
                  ) : (
                    <StyleSwatch styleId={s.id} height={120}/>
                  )}
                  {active && (
                    <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: PALETTE.espresso, color: PALETTE.bone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12}/>
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{s.emoji}</span>
                    <Serif style={{ fontSize: 17, color: PALETTE.espresso }}>{s.name}</Serif>
                  </div>
                  <Serif italic style={{ fontSize: 13, color: PALETTE.mute, marginTop: 4, lineHeight: 1.35 }}>{s.desc}</Serif>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </StageShell>
  );
}

// ============================================================================
// STAGE 6 â€” Words, Music, Narration, Length, Aspect
// ============================================================================
function WordsAndMusic({ data, update, onNext, onBack }) {
  return (
    <StageShell
      eyebrow="Step 5 of 7 Â· Words, music, length"
      title={<>The <em>finishing</em> details.</>}
      lede="All optional. We've chosen gentle defaults â€” adjust anything that doesn't feel right."
      onNext={onNext} onBack={onBack} canNext={true}
    >
      <FieldGroup label="Opening title">
        <input
          value={data.customWords}
          onChange={e => update({ customWords: e.target.value })}
          placeholder={`For ${data.petName || 'them'}.  Â·  2010 â€” 2024.`}
          style={{
            width: '100%', border: `1px solid ${PALETTE.parchment}`, borderRadius: 2, outline: 'none', padding: '14px 16px',
            fontFamily: '"Cormorant Garamond", serif', fontSize: 22, fontStyle: 'italic', color: PALETTE.espresso, background: 'white',
          }}/>
      </FieldGroup>

      <FieldGroup label="Music">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {[
            { id: 'piano_solo_01', name: 'Piano, gentle', desc: 'Solo, sparse, healing', pattern: 'piano', duration: '3:20' },
            { id: 'piano_strings_warm_01', name: 'Piano + strings', desc: 'Cinematic, warm', pattern: 'strings', duration: '3:30' },
            { id: 'ambient_pads_01', name: 'Ambient pads', desc: 'Ethereal, dream-like', pattern: 'pads', duration: '3:40' },
            { id: 'silence', name: 'No music', desc: 'Ambient sound only', pattern: 'silence', duration: 'â€”' },
          ].map(m => {
            const active = data.music === m.id;
            return (
              <button key={m.id} onClick={() => update({ music: m.id })}
                style={{
                  textAlign: 'left', padding: '14px 16px',
                  border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: active ? PALETTE.boneSoft : 'white',
                  cursor: 'pointer', borderRadius: 4, transition: 'all 180ms ease',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.brass; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.parchmentLight; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span onClick={e => e.stopPropagation()} style={{
                    width: 28, height: 28, borderRadius: '50%', background: PALETTE.espresso, color: PALETTE.bone,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                  }}>
                    <Play size={11} style={{ marginLeft: 1 }}/>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Serif style={{ fontSize: 16, lineHeight: 1.1 }}>{m.name}</Serif>
                    <Sans style={{ fontSize: 11, color: PALETTE.mute, marginTop: 2 }}>{m.desc} Â· {m.duration}</Sans>
                  </div>
                  {active && <Check size={13} color={PALETTE.espresso}/>}
                </div>
                <Waveform pattern={m.pattern} playing={active}/>
              </button>
            );
          })}
        </div>
      </FieldGroup>

      <FieldGroup label="Narration" hint="optional voiceover">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { id: 'off', name: 'No narration', desc: 'Music carries the tribute', icon: VolumeOff },
            { id: 'warm_female_alto', name: 'Warm female alto', desc: 'Soft, intimate, slightly breathy', icon: Mic },
            { id: 'warm_male_baritone', name: 'Warm male baritone', desc: 'Gentle, steady, lower register', icon: Mic },
            { id: 'user_recorded', name: 'My own voice', desc: 'Record and upload your own', icon: Mic },
          ].map(v => {
            const active = data.narration === v.id;
            const Icon = v.icon;
            return (
              <button key={v.id} onClick={() => update({ narration: v.id })}
                style={{
                  textAlign: 'left', padding: '12px 14px',
                  border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: active ? PALETTE.boneSoft : 'white',
                  cursor: 'pointer', borderRadius: 4, transition: 'all 180ms ease',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.brass; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.parchmentLight; }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: PALETTE.parchmentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color={PALETTE.brassDeep}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Serif style={{ fontSize: 15, lineHeight: 1.1 }}>{v.name}</Serif>
                  <Sans style={{ fontSize: 11, color: PALETTE.mute, marginTop: 2 }}>{v.desc}</Sans>
                </div>
                {active && <Check size={13} color={PALETTE.espresso}/>}
              </button>
            );
          })}
        </div>
      </FieldGroup>

      <FieldGroup label="Voiceover preview" hint="hidden when narration is off" >
        <div style={{ display: data.narration === 'off' ? 'none' : 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
          <Volume2 size={14} color={PALETTE.brassDeep}/>
          <Serif italic style={{ fontSize: 15, color: PALETTE.espressoSoft }}>
            "My dearest {data.petName || 'friend'}. You were the brightest thing in our daysâ€¦"
          </Serif>
        </div>
      </FieldGroup>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 12 }}>
        <FieldGroup label="Length">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LENGTHS.map(l => (
              <button key={l.id} onClick={() => update({ length: l.id })}
                style={{
                  textAlign: 'left', padding: '14px 16px',
                  border: `1px solid ${data.length === l.id ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: data.length === l.id ? PALETTE.boneSoft : 'white', cursor: 'pointer', borderRadius: 2,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                <div>
                  <Serif style={{ fontSize: 20 }}>{l.name}</Serif>
                  <Sans style={{ fontSize: 12, color: PALETTE.mute, marginTop: 2 }}>{l.subtitle}</Sans>
                </div>
                {data.length === l.id && <Check size={16} color={PALETTE.espresso}/>}
              </button>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup label="Aspect ratio">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ASPECTS.map(a => (
              <button key={a.id} onClick={() => update({ aspect: a.id })}
                style={{
                  textAlign: 'left', padding: '14px 16px',
                  border: `1px solid ${data.aspect === a.id ? PALETTE.espresso : PALETTE.parchmentLight}`,
                  background: data.aspect === a.id ? PALETTE.boneSoft : 'white', cursor: 'pointer', borderRadius: 2,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 32, height: 32, border: `1.5px solid ${PALETTE.espressoSoft}`, aspectRatio: a.ratio, display: 'flex', alignItems: 'center', justifyContent: 'center' }}/>
                  <div>
                    <Serif style={{ fontSize: 18 }}>{a.name} <Sans style={{ display: 'inline', fontSize: 12, color: PALETTE.mute }}> {a.id}</Sans></Serif>
                    <Sans style={{ fontSize: 12, color: PALETTE.mute }}>{a.subtitle}</Sans>
                  </div>
                </div>
                {data.aspect === a.id && <Check size={16} color={PALETTE.espresso}/>}
              </button>
            ))}
          </div>
        </FieldGroup>
      </div>
    </StageShell>
  );
}

// ============================================================================
// STAGE 7 â€” Beat sheet / storyboard review
// ============================================================================
function ReviewBeats({ data, update, onNext, onBack }) {
  const beatCount = data.length === 2 ? 8 : data.length === 3 ? 12 : 16;
  const themeObj = THEME_CATS.flatMap(c => c.themes).find(t => t.id === data.theme);
  const beatNames = ['Opening', 'First memory', 'Morning light', 'The favorite spot', 'A perfect day', 'Best friends', 'Quiet moments', 'The way they looked', 'A small adventure', 'Coming home', 'Stillness', 'Final breath', 'Goodbye', 'The crossing', 'Watching over', 'Forever'].slice(0, beatCount);

  return (
    <StageShell
      eyebrow="Step 6 of 7 Â· Review the storyboard"
      title={<>Here's the <em>shape</em> of it.</>}
      lede={`${beatCount} beats, hand-paced. Tap any scene to revise the caption or motion. When it feels right, we'll start the render.`}
      onNext={onNext} onBack={onBack} canNext={true}
      nextLabel="Looks right Â· start rendering"
    >
      <div style={{ background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4, padding: 20, marginBottom: 24 }}>
        <Eyebrow>Tribute summary</Eyebrow>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
          <SummaryItem label="For" value={data.petName || 'â€”'}/>
          <SummaryItem label="Format" value={FORMATS.find(f => f.id === data.format)?.name || 'â€”'}/>
          <SummaryItem label="Theme" value={themeObj?.name || 'â€”'}/>
          <SummaryItem label="Style" value={STYLES.find(s => s.id === data.style)?.name || 'â€”'}/>
          <SummaryItem label="Length" value={`${data.length} min Â· ${beatCount} beats`}/>
          <SummaryItem label="Format" value={data.aspect}/>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {beatNames.map((name, i) => (
          <div key={i} style={{
            border: `1px solid ${PALETTE.parchmentLight}`, background: 'white', borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
          }}>
            <BeatScene beatIndex={i} themeGradient={themeObj?.gradient} aspect={data.aspect} species={data.species}/>
            <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Serif style={{ fontSize: 15 }}>{name}</Serif>
              <Pencil size={11} color={PALETTE.mute}/>
            </div>
          </div>
        ))}
      </div>
    </StageShell>
  );
}

// ============================================================================
// STAGE 8 â€” Generation + final tribute
// ============================================================================
function FinalTribute({ data, onRestart }) {
  const beatCount = data.length === 2 ? 8 : data.length === 3 ? 12 : 16;
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const themeObj = THEME_CATS.flatMap(c => c.themes).find(t => t.id === data.theme);

  useEffect(() => {
    if (done) return;
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= beatCount) { clearInterval(iv); setDone(true); return beatCount; }
        return p + 1;
      });
    }, 380);
    return () => clearInterval(iv);
  }, [beatCount, done]);

  if (!done) {
    return (
      <section style={{ paddingTop: 32 }}>
        <Eyebrow>Step 7 of 7 Â· Rendering</Eyebrow>
        <Serif as="h2" italic style={{ fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05, marginTop: 14, marginBottom: 8, letterSpacing: '-0.01em' }}>
          We're making it now.
        </Serif>
        <Serif style={{ fontSize: 19, color: PALETTE.mute, lineHeight: 1.5, maxWidth: 580 }}>
          Each scene is being rendered, reviewed, and gently scored. Most tributes finish in a few minutes.
        </Serif>

        <div style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <Sans style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: PALETTE.brassDeep }}>
              Beat {progress} of {beatCount}
            </Sans>
            <Sans style={{ fontSize: 12, color: PALETTE.mute }}>{Math.round((progress / beatCount) * 100)}%</Sans>
          </div>
          <div style={{ height: 2, background: PALETTE.parchmentLight, borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(progress / beatCount) * 100}%`, background: PALETTE.brass, transition: 'width 380ms ease' }}/>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 32 }}>
          {Array.from({ length: beatCount }).map((_, i) => {
            const isDone = i < progress;
            const isCurrent = i === progress;
            if (isDone) {
              return (
                <div key={i} style={{ borderRadius: 4, overflow: 'hidden', border: `1px solid ${PALETTE.parchmentLight}` }}>
                  <BeatScene beatIndex={i} themeGradient={themeObj?.gradient} aspect={data.aspect} species={data.species}/>
                </div>
              );
            }
            return (
              <div key={i} style={{
                aspectRatio: data.aspect === '9:16' ? '9 / 16' : data.aspect === '16:9' ? '16 / 9' : '1',
                background: PALETTE.boneSoft,
                border: `1px solid ${isCurrent ? PALETTE.brass : PALETTE.parchmentLight}`,
                borderRadius: 4, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 400ms ease',
              }}>
                {isCurrent && <Loader2 size={18} color={PALETTE.brass} style={{ animation: 'spin 1.2s linear infinite' }}/>}
                {!isCurrent && <Sans style={{ fontSize: 11, color: PALETTE.mute }}>{i + 1}</Sans>}
              </div>
            );
          })}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </section>
    );
  }

  // Final tribute view
  return (
    <section style={{ paddingTop: 16 }}>
      <Eyebrow>Tribute Â· ready</Eyebrow>
      <Serif as="h2" italic style={{ fontSize: 'clamp(40px, 5.5vw, 64px)', lineHeight: 1.05, marginTop: 14, marginBottom: 8, letterSpacing: '-0.01em' }}>
        For {data.petName || 'them'}.
      </Serif>
      <Serif style={{ fontSize: 19, color: PALETTE.mute, lineHeight: 1.5, maxWidth: 600 }}>
        {data.customWords || `A ${data.length}-minute tribute, made with care. Yours to keep, yours to share.`}
      </Serif>

      <div style={{ marginTop: 32, background: PALETTE.espresso, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          aspectRatio: data.aspect === '9:16' ? '9 / 16' : data.aspect === '16:9' ? '16 / 9' : '1',
          background: themeObj?.gradient || PALETTE.brass,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          maxHeight: data.aspect === '9:16' ? 600 : 520,
          margin: data.aspect === '9:16' ? '0 auto' : '0',
          maxWidth: data.aspect === '9:16' ? 340 : '100%',
          position: 'relative',
        }}>
          <PetSketch size={180} color="rgba(255,255,255,0.9)" species={data.species}/>
          <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center' }}>
            <Serif italic style={{ fontSize: 32, color: 'white', textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>For {data.petName || 'them'}.</Serif>
            <Sans style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 6 }}>1995 â€” 2024</Sans>
          </div>
          <button onClick={() => setPlaying(p => !p)} style={{
            position: 'absolute', width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}>
            {playing ? <Pause size={22} color={PALETTE.espresso}/> : <Play size={22} color={PALETTE.espresso} style={{ marginLeft: 3 }}/>}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <PrimaryButton onClick={() => {}}>
          <Download size={15}/> Download tribute
        </PrimaryButton>
        <PrimaryButton onClick={() => {}} secondary>
          Get my memorial page link
        </PrimaryButton>
        <PrimaryButton onClick={() => {}} secondary>
          Add to family channel
        </PrimaryButton>
      </div>

      <div style={{ marginTop: 48, padding: '24px 26px', background: PALETTE.boneSoft, border: `1px solid ${PALETTE.parchmentLight}`, borderRadius: 4 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <Eyebrow>Your eulogy PDF is also ready</Eyebrow>
            <Serif italic style={{ fontSize: 19, color: PALETTE.espressoSoft, marginTop: 6 }}>
              A printable companion piece â€” your words, their photo, designed to keep.
            </Serif>
          </div>
          <PrimaryButton onClick={() => {}} small secondary>
            <Download size={13}/> PDF
          </PrimaryButton>
        </div>
      </div>

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <button onClick={onRestart} style={{ background: 'transparent', border: 'none', color: PALETTE.mute, fontFamily: 'Inter, sans-serif', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 4, cursor: 'pointer' }}>
          Start a tribute for another pet
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// Shared components
// ============================================================================
function StageShell({ eyebrow, title, lede, children, onNext, onBack, canNext, nextLabel = 'Continue', hideNext, secondaryAction }) {
  return (
    <section style={{ paddingTop: 16 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Serif as="h2" italic style={{ fontSize: 'clamp(34px, 4.5vw, 52px)', lineHeight: 1.05, marginTop: 14, marginBottom: 12, letterSpacing: '-0.01em' }}>
        {title}
      </Serif>
      <Serif style={{ fontSize: 18, color: PALETTE.mute, lineHeight: 1.5, maxWidth: 620, marginBottom: 36 }}>
        {lede}
      </Serif>
      <div>{children}</div>
      <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${PALETTE.parchmentLight}`, paddingTop: 24 }}>
        <button onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: PALETTE.mute, fontFamily: 'Inter, sans-serif', fontSize: 13, cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={14}/> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {secondaryAction}
          {!hideNext && (
            <PrimaryButton onClick={onNext} disabled={!canNext}>
              {nextLabel} <ArrowRight size={15}/>
            </PrimaryButton>
          )}
        </div>
      </div>
    </section>
  );
}

function FieldGroup({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <Serif style={{ fontSize: 22, color: PALETTE.espresso }}>{label}</Serif>
        {hint && <Sans style={{ fontSize: 12, color: PALETTE.mute, fontStyle: 'italic' }}>{hint}</Sans>}
      </div>
      {children}
    </div>
  );
}

function ChoiceCard({ active, onClick, icon, emoji, title, desc, compact }) {
  return (
    <button onClick={onClick}
      style={{
        textAlign: 'left', padding: compact ? '14px 16px' : '18px 18px',
        border: `1px solid ${active ? PALETTE.espresso : PALETTE.parchmentLight}`,
        background: active ? PALETTE.boneSoft : 'white',
        cursor: 'pointer', borderRadius: 4, transition: 'all 180ms ease',
        display: 'flex', flexDirection: 'column', gap: 6, minHeight: compact ? 'auto' : 100,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.brass; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = PALETTE.parchmentLight; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: PALETTE.brassDeep }}>
        {emoji ? <span style={{ fontSize: 18 }}>{emoji}</span> : icon}
        <Serif style={{ fontSize: 18, color: PALETTE.espresso }}>{title}</Serif>
        {active && <Check size={14} color={PALETTE.espresso} style={{ marginLeft: 'auto' }}/>}
      </div>
      <Serif italic style={{ fontSize: 14, color: PALETTE.mute, lineHeight: 1.4 }}>{desc}</Serif>
    </button>
  );
}

function PathCard({ title, tagline, icon, onClick, accent }) {
  return (
    <button onClick={onClick}
      style={{
        textAlign: 'left', padding: '32px 28px',
        border: `1px solid ${accent ? PALETTE.brass : PALETTE.parchment}`,
        background: accent ? 'rgba(201,169,97,0.06)' : 'white',
        cursor: 'pointer', borderRadius: 4, transition: 'all 200ms ease', minHeight: 200,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(42,33,27,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ color: PALETTE.brassDeep }}>{icon}</div>
      <Serif style={{ fontSize: 28 }}>{title}</Serif>
      <Serif italic style={{ fontSize: 16, color: PALETTE.mute, lineHeight: 1.4 }}>{tagline}</Serif>
      <div style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: accent ? PALETTE.brassDeep : PALETTE.espresso }}>
        <Sans style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Choose this</Sans>
        <ChevronRight size={14}/>
      </div>
    </button>
  );
}

function Tag({ children }) {
  return (
    <Sans style={{
      fontSize: 11, padding: '4px 8px', border: `1px solid ${PALETTE.parchment}`, borderRadius: 999,
      color: PALETTE.mute, letterSpacing: '0.04em',
    }}>{children}</Sans>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div>
      <Sans style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: PALETTE.mute }}>{label}</Sans>
      <Serif italic style={{ fontSize: 18, color: PALETTE.espresso, marginTop: 2 }}>{value}</Serif>
    </div>
  );
}

