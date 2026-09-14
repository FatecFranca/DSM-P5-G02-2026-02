import json
import shutil
import tempfile
import unittest
from pathlib import Path

from src.pipeline import analyze_data, prepare_data
from src.preprocessing.dataset import read_jsonl_gz


FIXTURES = Path(__file__).parent / "fixtures"


class PipelineTest(unittest.TestCase):
    def test_prepares_and_analyzes_both_official_sources_end_to_end(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "data" / "raw"
            files = {
                raw / "camara" / "proposicoes" / "proposicoes-2025.csv": "camara-proposicoes.csv",
                raw / "camara" / "temas" / "proposicoesTemas-2025.csv": "camara-temas.csv",
                raw / "camara" / "temas" / "taxonomy.json": "camara-taxonomy.json",
                raw / "senado" / "processos" / "processos-2025.csv": "senado-processos.csv",
                raw / "senado" / "classes" / "classes.json": "senado-classes.json",
                raw / "senado" / "classes" / "processos-classe-11.csv": "senado-classe.csv",
                raw / "senado" / "classes" / "processos-classe-10.csv": "senado-classe-empty.csv",
            }
            for destination, fixture in files.items():
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(FIXTURES / fixture, destination)

            preparation = prepare_data(root, [2025], {"CAMARA", "SENADO"})
            report = analyze_data(root, [2025])

            all_documents = list(
                read_jsonl_gz(root / "data" / "processed" / "all_documents.jsonl.gz")
            )
            training = list(
                read_jsonl_gz(
                    root / "data" / "processed" / "training_dataset.jsonl.gz"
                )
            )
            self.assertEqual(len(all_documents), 6)
            self.assertEqual(len(training), 4)
            self.assertEqual(preparation["training_documents"], 4)
            self.assertEqual(report["taxonomy"]["number_of_official_themes"], 5)
            self.assertEqual(report["taxonomy"]["number_of_observed_themes"], 4)
            self.assertEqual(report["duplicates"]["duplicate_id_rows"], 1)
            self.assertTrue((root / "reports" / "dataset-analysis.md").is_file())
            persisted = json.loads(
                (root / "reports" / "dataset-analysis.json").read_text("utf-8")
            )
            self.assertEqual(persisted["dataset"]["total_documents"], 6)

            with self.assertRaisesRegex(ValueError, "janela"):
                analyze_data(root, [2024])

    def test_fails_when_an_expected_annual_file_is_missing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            destination = (
                root / "data" / "raw" / "camara" / "proposicoes" / "proposicoes-2025.csv"
            )
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(FIXTURES / "camara-proposicoes.csv", destination)

            with self.assertRaisesRegex(FileNotFoundError, "proposicoesTemas-2025"):
                prepare_data(root, [2025], {"CAMARA"})


if __name__ == "__main__":
    unittest.main()
