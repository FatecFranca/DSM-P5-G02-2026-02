import json
import tempfile
import unittest
from pathlib import Path

from src.preprocessing.dataset import write_jsonl_gz
from src.training.data import load_camara_training_data


class TrainingDataTest(unittest.TestCase):
    def test_loads_only_valid_camara_documents_and_official_labels(self):
        taxonomy = [
            {"source": "CAMARA", "code": "34", "name": "Administração Pública", "path": None},
            {"source": "CAMARA", "code": "46", "name": "Educação", "path": None},
            {"source": "SENADO", "code": "11", "name": "Saúde", "path": "Saúde"},
        ]
        documents = [
            {
                "document_id": "CAMARA:1",
                "source": "CAMARA",
                "external_id": 1,
                "ano": 2025,
                "ementa": "  Institui política de educação.  ",
                "ementa_status": "valid",
                "labels": [{"code": "46", "name": "Educação", "path": None}],
            },
            {
                "document_id": "SENADO:2",
                "source": "SENADO",
                "external_id": 2,
                "ano": 2025,
                "ementa": "Institui política de saúde.",
                "ementa_status": "valid",
                "labels": [{"code": "11", "name": "Saúde", "path": "Saúde"}],
            },
            {
                "document_id": "CAMARA:3",
                "source": "CAMARA",
                "external_id": 3,
                "ano": 2025,
                "ementa": "Tema fora da taxonomia.",
                "ementa_status": "valid",
                "labels": [{"code": "999", "name": "Inventado", "path": None}],
            },
        ]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset_path = root / "training.jsonl.gz"
            taxonomy_path = root / "taxonomy.json"
            write_jsonl_gz(dataset_path, documents)
            taxonomy_path.write_text(
                json.dumps(taxonomy, ensure_ascii=False), encoding="utf-8"
            )

            loaded, classes = load_camara_training_data(dataset_path, taxonomy_path)

        self.assertEqual([item["external_id"] for item in loaded], [1])
        self.assertEqual(loaded[0]["ementa"], "Institui política de educação.")
        self.assertEqual([item["code"] for item in classes], ["34", "46"])

    def test_rejects_duplicate_official_class_codes(self):
        taxonomy = [
            {"source": "CAMARA", "code": "46", "name": "Educação"},
            {"source": "CAMARA", "code": "46", "name": "Outro nome"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset_path = root / "training.jsonl.gz"
            taxonomy_path = root / "taxonomy.json"
            write_jsonl_gz(dataset_path, [])
            taxonomy_path.write_text(json.dumps(taxonomy), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "duplicado"):
                load_camara_training_data(dataset_path, taxonomy_path)


if __name__ == "__main__":
    unittest.main()
