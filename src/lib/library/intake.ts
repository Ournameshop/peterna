// Intake content — transcribed verbatim from the spec's embedded library YAML
// (SKILL v2.3, §EMBEDDED ASSET LIBRARY).
//
// `[PET_NAME]` placeholders in labels/placeholders are substituted at render
// time by the component layer once the name is captured in Stage 1.3.

export type MemoryPromptId =
  | 'sound_smell_feeling'
  | 'would_not_believe'
  | 'most_want_to_remember';

export type MemoryPrompt = {
  readonly id: MemoryPromptId;
  readonly label: string;
  readonly placeholder: string;
};

export const MEMORY_PROMPTS: ReadonlyArray<MemoryPrompt> = [
  {
    id: 'sound_smell_feeling',
    label: 'A sound, smell, or feeling that brings [PET_NAME] back',
    placeholder: 'e.g. the click of his nails on the kitchen floor',
  },
  {
    id: 'would_not_believe',
    label: 'Something [PET_NAME] did that nobody else would believe',
    placeholder: 'e.g. she could open the back door by herself',
  },
  {
    id: 'most_want_to_remember',
    label: 'The thing you most want to remember',
    placeholder: 'e.g. how he greeted me at the door every single day',
  },
] as const;

export type PersonalityTraitId =
  | 'escape_artist'
  | 'greeter_at_door'
  | 'shadow_at_feet'
  | 'class_clown'
  | 'protector'
  | 'cuddle_thief'
  | 'watchman'
  | 'wanderer'
  | 'wise_old_soul'
  | 'eternal_puppy';

export type PersonalityTrait = {
  readonly id: PersonalityTraitId;
  readonly label: string;
  readonly phrase: string;
  readonly adjective_tag: string;
};

export const PERSONALITY_TRAITS: ReadonlyArray<PersonalityTrait> = [
  {
    id: 'escape_artist',
    label: 'The escape artist',
    phrase: 'an escape artist who always found a way out',
    adjective_tag: 'mischievous',
  },
  {
    id: 'greeter_at_door',
    label: 'The greeter at the door',
    phrase: 'the one who was always waiting at the door',
    adjective_tag: 'loyal',
  },
  {
    id: 'shadow_at_feet',
    label: 'The shadow at my feet',
    phrase: 'my shadow, never more than a step away',
    adjective_tag: 'cuddly',
  },
  {
    id: 'class_clown',
    label: 'The class clown',
    phrase: 'the one who made everyone laugh',
    adjective_tag: 'goofy',
  },
  {
    id: 'protector',
    label: 'The protector',
    phrase: 'the brave one who always watched over us',
    adjective_tag: 'brave',
  },
  {
    id: 'cuddle_thief',
    label: 'The cuddle thief',
    phrase: 'a relentless thief of laps and warm spots',
    adjective_tag: 'cuddly',
  },
  {
    id: 'watchman',
    label: 'The watchman',
    phrase: 'the one who saw everything from the window',
    adjective_tag: 'curious',
  },
  {
    id: 'wanderer',
    label: 'The wanderer',
    phrase: 'always exploring, always curious',
    adjective_tag: 'curious',
  },
  {
    id: 'wise_old_soul',
    label: 'The wise old soul',
    phrase: 'an old soul, calm and knowing',
    adjective_tag: 'gentle',
  },
  {
    id: 'eternal_puppy',
    label: 'The eternal puppy',
    phrase: 'forever young at heart',
    adjective_tag: 'playful',
  },
] as const;

export type FavoriteThingId =
  | 'naps_in_sunbeams'
  | 'window_watchman'
  | 'four_pm_walk'
  | 'car_rides'
  | 'favorite_toy'
  | 'stealing_socks'
  | 'mealtime_drama'
  | 'cuddles_on_couch'
  | 'the_beach'
  | 'snow_days'
  | 'treats_hidden_anywhere'
  | 'backyard_patrol';

export type FavoriteThing = {
  readonly id: FavoriteThingId;
  readonly label: string;
  readonly scene_hint: string;
};

export const FAVORITE_THINGS: ReadonlyArray<FavoriteThing> = [
  {
    id: 'naps_in_sunbeams',
    label: 'Naps in sunbeams',
    scene_hint: 'lying peacefully in a wide sunbeam on the floor or couch',
  },
  {
    id: 'window_watchman',
    label: 'Window-watchman duty',
    scene_hint: 'watching the world from a favorite window perch',
  },
  {
    id: 'four_pm_walk',
    label: 'The 4pm walk',
    scene_hint: 'on a familiar walking path at late-afternoon golden hour',
  },
  {
    id: 'car_rides',
    label: 'Car rides with the window down',
    scene_hint: 'head out the car window, ears flapping in the wind',
  },
  {
    id: 'favorite_toy',
    label: 'Their favorite toy',
    scene_hint: 'in a play-bow with their well-loved favorite toy',
  },
  {
    id: 'stealing_socks',
    label: 'Stealing socks',
    scene_hint: 'a stolen sock dangling from their mouth, mischievous eyes',
  },
  {
    id: 'mealtime_drama',
    label: 'Mealtime drama',
    scene_hint: 'alert and joyful at the food bowl, full attention',
  },
  {
    id: 'cuddles_on_couch',
    label: 'Cuddles on the couch',
    scene_hint: 'curled into a soft cuddle on the family couch',
  },
  {
    id: 'the_beach',
    label: 'The beach',
    scene_hint: 'running along wet sand at sunset, pawprints behind',
  },
  {
    id: 'snow_days',
    label: 'Snow days',
    scene_hint: 'bounding through fresh snow with pure joy',
  },
  {
    id: 'treats_hidden_anywhere',
    label: 'Treats hidden anywhere',
    scene_hint: 'alert, focused, the unmistakable look of a treat detected',
  },
  {
    id: 'backyard_patrol',
    label: 'The backyard patrol',
    scene_hint: 'doing the rounds of the backyard at golden hour',
  },
] as const;
