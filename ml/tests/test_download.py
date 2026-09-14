import tempfile
import unittest
from http.client import IncompleteRead
from pathlib import Path
from unittest.mock import patch

from src.extraction.download import download_file


class DownloadTest(unittest.TestCase):
    def test_downloads_stream_and_records_reproducibility_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.csv"
            source.write_bytes(b"id;ementa\n1;Texto\n")
            destination = root / "raw" / "download.csv"

            metadata = download_file(source.as_uri(), destination, "CAMARA")

            self.assertEqual(destination.read_bytes(), source.read_bytes())
            self.assertEqual(metadata["source"], "CAMARA")
            self.assertEqual(metadata["bytes"], 18)
            self.assertEqual(
                metadata["sha256"],
                "69bda7768c0d2156369c45f192a20fd7a565450f8f746417e5ca09522d9588da",
            )
            self.assertFalse(metadata["reused"])

    def test_reuses_existing_download_unless_force_is_requested(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.csv"
            destination = root / "download.csv"
            source.write_text("first", encoding="utf-8")
            download_file(source.as_uri(), destination, "SENADO")
            source.write_text("second", encoding="utf-8")

            metadata = download_file(
                source.as_uri(),
                destination,
                "SENADO",
                previous_metadata={
                    "retrieved_at": "2025-01-01T00:00:00+00:00",
                    "etag": "official-etag",
                    "sha256": "a7937b64b8caa58f03721bb6bacf5c78cb235febe0e70b1b84cd99541461a08e",
                },
            )

            self.assertEqual(destination.read_text("utf-8"), "first")
            self.assertTrue(metadata["reused"])
            self.assertEqual(metadata["retrieved_at"], "2025-01-01T00:00:00+00:00")
            self.assertEqual(metadata["etag"], "official-etag")
            self.assertIn("verified_at", metadata)

    def test_retries_an_incomplete_chunked_response(self):
        class Response:
            headers = {}

            def __init__(self, chunks):
                self.chunks = iter(chunks)

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self, _size):
                chunk = next(self.chunks)
                if isinstance(chunk, Exception):
                    raise chunk
                return chunk

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "download.csv"
            responses = [
                Response([IncompleteRead(b"partial", 2)]),
                Response([b"complete", b""]),
            ]

            with patch(
                "src.extraction.download.urlopen", side_effect=responses
            ), patch("src.extraction.download.time.sleep"):
                metadata = download_file(
                    "https://example.invalid/data.csv", destination, "SENADO"
                )

            self.assertEqual(destination.read_bytes(), b"complete")
            self.assertEqual(metadata["bytes"], 8)


if __name__ == "__main__":
    unittest.main()
