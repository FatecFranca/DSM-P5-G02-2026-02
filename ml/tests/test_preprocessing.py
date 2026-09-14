import tempfile
import unittest
import unicodedata
from pathlib import Path

from src.preprocessing.dataset import (
    build_dataset,
    is_training_candidate,
    normalize_text,
    read_jsonl_gz,
    write_jsonl_gz,
)


class PreprocessingTest(unittest.TestCase):
    def test_normalizes_unicode_and_whitespace_conservatively(self):
        decomposed = unicodedata.normalize("NFD", "Não retira 2 direitos")

        normalized = normalize_text(f"  {decomposed}\n\t por lei  ")

        self.assertEqual(normalized, "Não retira 2 direitos por lei")

    def test_preserves_multilabel_and_documents_without_label_or_ementa(self):
        documents = [
            {
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": " Texto válido. ",
                "ementa_present": True,
            },
            {
                "source": "CAMARA",
                "external_id": 2,
                "ano": 2025,
                "tipo": "REQ",
                "ementa": "",
                "ementa_present": True,
            },
        ]
        assignments = [
            (
                "CAMARA",
                1,
                {"code": "34", "name": "Administração Pública", "path": None},
            ),
            (
                "CAMARA",
                1,
                {"code": "46", "name": "Educação", "path": None},
            ),
        ]

        dataset, diagnostics = build_dataset(documents, assignments)

        self.assertEqual(len(dataset), 2)
        self.assertEqual([label["code"] for label in dataset[0]["labels"]], ["34", "46"])
        self.assertEqual(dataset[1]["labels"], [])
        self.assertEqual(dataset[1]["ementa_status"], "empty")
        self.assertEqual(diagnostics["orphan_label_assignments"], 0)

    def test_reports_duplicate_ids_and_conflicting_labels_for_same_text(self):
        documents = [
            {
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Texto repetido.",
                "ementa_present": True,
            },
            {
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Texto repetido.",
                "ementa_present": True,
            },
            {
                "source": "CAMARA",
                "external_id": 2,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Texto repetido.",
                "ementa_present": True,
            },
        ]
        assignments = [
            ("CAMARA", 1, {"code": "46", "name": "Educação", "path": None}),
            ("CAMARA", 2, {"code": "56", "name": "Saúde", "path": None}),
        ]

        dataset, diagnostics = build_dataset(documents, assignments)

        self.assertEqual(len(dataset), 2)
        self.assertEqual(diagnostics["duplicate_id_rows"], 1)
        self.assertEqual(diagnostics["label_name_conflicts"], 0)
        self.assertEqual(diagnostics["duplicate_ementa_groups"], 1)
        self.assertEqual(diagnostics["duplicate_ementa_conflicting_label_groups"], 1)

    def test_rejects_malformed_label_without_creating_ground_truth(self):
        documents = [
            {
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Texto válido.",
                "ementa_present": True,
            }
        ]
        assignments = [
            ("CAMARA", 1, {"code": "", "name": "", "path": None})
        ]

        dataset, diagnostics = build_dataset(documents, assignments)

        self.assertEqual(dataset[0]["labels"], [])
        self.assertEqual(diagnostics["invalid_label_assignments"], 1)

    def test_reuses_same_official_label_name_without_reporting_conflict(self):
        documents = [
            {
                "source": "CAMARA",
                "external_id": external_id,
                "ano": 2025,
                "tipo": "PL",
                "ementa": f"Texto oficial {external_id}.",
                "ementa_present": True,
            }
            for external_id in (1, 2)
        ]
        label = {"code": "46", "name": "Educação", "path": None}

        _, diagnostics = build_dataset(
            documents,
            [("CAMARA", 1, label), ("CAMARA", 2, label)],
        )

        self.assertEqual(diagnostics["label_name_conflicts"], 0)

    def test_excludes_conflicting_identity_from_training_candidates(self):
        documents = [
            {
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Primeira versão oficial.",
                "ementa_present": True,
            },
            {
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2025,
                "tipo": "PL",
                "ementa": "Segunda versão oficial diferente.",
                "ementa_present": True,
            },
        ]
        assignments = [
            ("CAMARA", 1, {"code": "46", "name": "Educação", "path": None})
        ]

        dataset, _ = build_dataset(documents, assignments)

        self.assertTrue(dataset[0]["duplicate_identity_conflict"])
        self.assertFalse(is_training_candidate(dataset[0]))

    def test_exports_and_reads_gzip_jsonl_without_data_loss(self):
        records = [{"source": "CAMARA", "external_id": 1, "labels": []}]
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "dataset.jsonl.gz"

            write_jsonl_gz(destination, records)

            self.assertEqual(list(read_jsonl_gz(destination)), records)

    def test_gzip_export_is_byte_reproducible(self):
        records = [{"source": "CAMARA", "external_id": 1, "labels": []}]
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.jsonl.gz"
            second = Path(directory) / "second.jsonl.gz"

            write_jsonl_gz(first, records)
            write_jsonl_gz(second, records)

            self.assertEqual(first.read_bytes(), second.read_bytes())


if __name__ == "__main__":
    unittest.main()
