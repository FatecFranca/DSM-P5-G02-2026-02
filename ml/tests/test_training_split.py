import unittest

from src.training.split import (
    analyze_groups,
    assert_no_group_leakage,
    group_id,
    split_grouped_documents,
)


def _document(external_id, text, labels):
    return {
        "document_id": f"CAMARA:{external_id}",
        "source": "CAMARA",
        "external_id": external_id,
        "ano": 2025,
        "ementa": text,
        "ementa_status": "valid",
        "labels": [
            {"code": code, "name": f"Tema {code}", "path": None}
            for code in labels
        ],
    }


class TrainingSplitTest(unittest.TestCase):
    def setUp(self):
        self.documents = [
            _document(1, "Cria política de educação.", ["46"]),
            _document(2, "  Cria política de educação.\n", ["46", "34"]),
            _document(3, "Dispõe sobre servidores públicos.", ["34"]),
            _document(4, "Institui programa de ensino.", ["46"]),
            _document(5, "Altera regra administrativa.", ["34"]),
            _document(6, "Regula escolas públicas.", ["46"]),
            _document(7, "Define carreira federal.", ["34"]),
            _document(8, "Cria bolsa de estudos.", ["46"]),
            _document(9, "Organiza órgão público.", ["34"]),
            _document(10, "Amplia acesso à escola.", ["46"]),
            _document(11, "Disciplina concurso público.", ["34"]),
            _document(12, "Financia educação básica.", ["46"]),
        ]

    def test_group_id_is_deterministic_after_conservative_normalization(self):
        first = group_id("  Não reduz 2 direitos.\n")
        second = group_id("Não reduz 2 direitos.")

        self.assertEqual(first, second)
        self.assertEqual(len(first), 64)

    def test_reports_duplicate_and_conflicting_groups(self):
        analysis = analyze_groups(self.documents)

        self.assertEqual(analysis["groups"], 11)
        self.assertEqual(analysis["duplicate_groups"], 1)
        self.assertEqual(analysis["conflicting_groups"], 1)
        self.assertEqual(analysis["conflicting_documents"], 2)

    def test_split_is_reproducible_and_keeps_equal_text_together(self):
        first = split_grouped_documents(
            self.documents, ["34", "46"], ratios=(0.5, 0.25, 0.25), seed=42
        )
        second = split_grouped_documents(
            list(reversed(self.documents)),
            ["34", "46"],
            ratios=(0.5, 0.25, 0.25),
            seed=42,
        )

        first_ids = {
            name: [item["document_id"] for item in records]
            for name, records in first.items()
        }
        second_ids = {
            name: [item["document_id"] for item in records]
            for name, records in second.items()
        }
        self.assertEqual(first_ids, second_ids)
        assert_no_group_leakage(first)
        location = {
            item["document_id"]: name
            for name, records in first.items()
            for item in records
        }
        self.assertEqual(location["CAMARA:1"], location["CAMARA:2"])

    def test_leakage_validation_fails_on_overlapping_group(self):
        splits = {
            "train": [self.documents[0]],
            "validation": [self.documents[1]],
            "test": [self.documents[2]],
        }

        with self.assertRaisesRegex(ValueError, "leakage"):
            assert_no_group_leakage(splits)

    def test_large_multilabel_split_stays_close_to_requested_document_ratios(self):
        classes = [str(code) for code in range(32)]
        documents = []
        for external_id in range(1, 321):
            labels = {str(external_id % 32)}
            if external_id % 2 == 0:
                labels.add("0")
            if external_id % 3 == 0:
                labels.add("1")
            if external_id % 5 == 0:
                labels.add("2")
            documents.append(
                _document(
                    external_id,
                    f"Ementa legislativa única número {external_id}.",
                    sorted(labels),
                )
            )

        splits = split_grouped_documents(documents, classes, seed=42)

        self.assertLessEqual(abs(len(splits["train"]) - 224), 3)
        self.assertLessEqual(abs(len(splits["validation"]) - 48), 3)
        self.assertLessEqual(abs(len(splits["test"]) - 48), 3)
        average_labels = {
            name: sum(len(item["labels"]) for item in records) / len(records)
            for name, records in splits.items()
        }
        self.assertLessEqual(max(average_labels.values()) - min(average_labels.values()), 0.15)


if __name__ == "__main__":
    unittest.main()
