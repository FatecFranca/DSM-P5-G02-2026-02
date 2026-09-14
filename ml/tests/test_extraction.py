import json
import tempfile
import unittest
from pathlib import Path

from src.extraction.official_sources import (
    flatten_senado_taxonomy,
    parse_camara_taxonomy,
    parse_camara_documents,
    parse_camara_labels,
    parse_senado_class_assignments,
    parse_senado_documents,
)


FIXTURES = Path(__file__).parent / "fixtures"


class ExtractionTest(unittest.TestCase):
    def test_parses_camara_documents_with_stable_identity(self):
        documents = list(
            parse_camara_documents(FIXTURES / "camara-proposicoes.csv")
        )

        self.assertEqual(documents[0]["source"], "CAMARA")
        self.assertEqual(documents[0]["external_id"], 101)
        self.assertEqual(documents[0]["tipo"], "PL")
        self.assertEqual(documents[0]["ano"], 2025)

    def test_relates_all_camara_labels_by_uri_id(self):
        assignments = list(parse_camara_labels(FIXTURES / "camara-temas.csv"))

        labels_101 = [item[1] for item in assignments if item[0] == 101]
        self.assertEqual(
            labels_101,
            [
                {"code": "34", "name": "Administração Pública", "path": None},
                {"code": "46", "name": "Educação", "path": None},
            ],
        )

    def test_parses_senado_documents_and_official_type(self):
        documents = list(parse_senado_documents(FIXTURES / "senado-processos.csv"))

        self.assertEqual(documents[0]["source"], "SENADO")
        self.assertEqual(documents[0]["external_id"], 201)
        self.assertEqual(documents[0]["tipo"], "PL")
        self.assertEqual(documents[0]["presentation_year"], 2025)

    def test_rejects_csv_with_unexpected_headers_or_delimiter(self):
        with tempfile.TemporaryDirectory() as directory:
            invalid = Path(directory) / "invalid.csv"
            invalid.write_text("id;ementa\n1;Texto\n", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "cabeçalho"):
                list(parse_senado_documents(invalid))

    def test_uses_presentation_year_when_identification_year_is_zero(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "proposicoes-2025.csv"
            source.write_text(
                "id;ano;siglaTipo;ementa;dataApresentacao\n"
                "1;0;REQ;Solicita informação.;2025-04-03\n",
                encoding="utf-8",
            )

            document = list(parse_camara_documents(source))[0]

            self.assertEqual(document["ano"], 2025)
            self.assertEqual(document["identification_year"], 0)
            self.assertEqual(document["partition_year"], 2025)

    def test_parses_complete_camara_taxonomy(self):
        taxonomy = parse_camara_taxonomy(FIXTURES / "camara-taxonomy.json")

        self.assertEqual(len(taxonomy), 3)
        self.assertEqual(
            taxonomy[1],
            {"code": "46", "name": "Educação", "path": None},
        )

    def test_flattens_senado_taxonomy_preserving_hierarchy(self):
        taxonomy = flatten_senado_taxonomy(
            json.loads((FIXTURES / "senado-classes.json").read_text("utf-8"))
        )

        self.assertEqual(
            taxonomy,
            [
                {"code": "10", "name": "Política Social", "path": "Política Social"},
                {
                    "code": "11",
                    "name": "Saúde",
                    "path": "Política Social / Saúde",
                },
            ],
        )

    def test_parses_senado_class_assignment_without_inventing_ancestors(self):
        label = {"code": "11", "name": "Saúde", "path": "Política Social / Saúde"}

        assignments = list(
            parse_senado_class_assignments(
                FIXTURES / "senado-classe.csv", label
            )
        )

        self.assertEqual(assignments, [(201, label)])


if __name__ == "__main__":
    unittest.main()
