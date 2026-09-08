#!/usr/bin/env python3
import unittest

from practice_observations import PracticeObservation, SelectionCondition


class PracticeObservationTest(unittest.TestCase):
    def observation(self, **overrides):
        values = {
            "id": "spotify-lineage-01",
            "projection_id": "main",
            "evidence_id": "2025-11-06-spotify-honk-part-1",
            "use_case": "Find affected repositories",
            "problem": "The agent must discover downstream consumers",
            "reported_practice": "Use dependency lineage",
            "selection_conditions": (SelectionCondition.CONTEXT,),
        }
        values.update(overrides)
        return PracticeObservation(**values)

    def test_accepts_every_selection_condition(self):
        for condition in SelectionCondition:
            with self.subTest(condition=condition):
                self.observation(selection_conditions=(condition,))

    def test_accepts_multiple_selection_conditions(self):
        observation = self.observation(
            selection_conditions=(SelectionCondition.VERIFICATION, SelectionCondition.LEARNING)
        )
        self.assertEqual(2, len(observation.selection_conditions))

    def test_rejects_unknown_selection_condition(self):
        with self.assertRaisesRegex(ValueError, "only SelectionCondition"):
            self.observation(selection_conditions=("unknown",))

    def test_rejects_empty_selection_conditions(self):
        with self.assertRaisesRegex(ValueError, "at least one"):
            self.observation(selection_conditions=())

    def test_rejects_required_empty_strings(self):
        for field in ("id", "projection_id", "evidence_id", "use_case", "problem", "reported_practice"):
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, field):
                self.observation(**{field: "   "})

    def test_identical_observations_from_different_projections_remain_distinct(self):
        main = self.observation(projection_id="main")
        preview = self.observation(projection_id="0123456789ab")
        self.assertNotEqual(main, preview)

    def test_identical_observations_from_different_evidence_remain_distinct(self):
        first = self.observation(evidence_id="2025-11-06-spotify-honk-part-1")
        second = self.observation(evidence_id="2025-11-24-spotify-honk-part-2")
        self.assertNotEqual(first, second)

    def test_rejects_duplicate_conditions(self):
        with self.assertRaisesRegex(ValueError, "duplicates"):
            self.observation(
                selection_conditions=(SelectionCondition.CONTEXT, SelectionCondition.CONTEXT)
            )


if __name__ == "__main__":
    unittest.main()
