import hashlib
import math
from collections import Counter, defaultdict

from ..preprocessing.dataset import normalize_text


SPLIT_NAMES = ("train", "validation", "test")


def group_id(text: str) -> str:
    normalized = normalize_text(text)
    if not normalized:
        raise ValueError("Não é possível agrupar uma ementa vazia.")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _label_codes(document: dict) -> tuple[str, ...]:
    return tuple(sorted(str(label["code"]) for label in document["labels"]))


def _groups(documents: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for raw in documents:
        document = dict(raw)
        document["group_id"] = group_id(document["ementa"])
        grouped[document["group_id"]].append(document)
    for records in grouped.values():
        records.sort(key=lambda item: (item["external_id"], item["document_id"]))
    return dict(grouped)


def analyze_groups(documents: list[dict]) -> dict:
    grouped = _groups(documents)
    duplicates = [records for records in grouped.values() if len(records) > 1]
    conflicting = [
        records
        for records in duplicates
        if len({_label_codes(item) for item in records}) > 1
    ]
    conflict_types = Counter()
    for records in conflicting:
        label_sets = sorted({"+".join(_label_codes(item)) for item in records})
        conflict_types[" <> ".join(label_sets)] += 1
    return {
        "groups": len(grouped),
        "duplicate_groups": len(duplicates),
        "duplicate_documents": sum(len(records) for records in duplicates),
        "conflicting_groups": len(conflicting),
        "conflicting_documents": sum(len(records) for records in conflicting),
        "conflict_type_count": len(conflict_types),
        "conflict_types": [
            {"label_sets": key, "groups": count}
            for key, count in conflict_types.most_common(20)
        ],
    }


def split_grouped_documents(
    documents: list[dict],
    classes: list[str],
    ratios: tuple[float, float, float] = (0.7, 0.15, 0.15),
    seed: int = 42,
) -> dict[str, list[dict]]:
    if len(ratios) != 3 or any(ratio <= 0 for ratio in ratios):
        raise ValueError("O split exige três proporções positivas.")
    if abs(sum(ratios) - 1.0) > 1e-9:
        raise ValueError("As proporções do split devem somar 1.")
    if not documents:
        raise ValueError("O dataset de treinamento está vazio.")

    grouped = _groups(documents)
    class_set = set(classes)
    total_labels = Counter(
        code
        for document in documents
        for code in _label_codes(document)
        if code in class_set
    )
    group_stats = []
    for identifier, records in grouped.items():
        counts = Counter(
            code
            for document in records
            for code in _label_codes(document)
            if code in class_set
        )
        rarity = min((total_labels[code] for code in counts), default=0)
        tie = hashlib.sha256(f"{seed}:{identifier}".encode("ascii")).hexdigest()
        group_stats.append((rarity, -len(counts), -len(records), tie, identifier, counts))
    group_stats.sort()

    total_documents = len(documents)
    exact_targets = [total_documents * ratio for ratio in ratios]
    integer_targets = [math.floor(value) for value in exact_targets]
    remaining = total_documents - sum(integer_targets)
    remainder_order = sorted(
        range(3),
        key=lambda index: (-(exact_targets[index] - integer_targets[index]), index),
    )
    for index in remainder_order[:remaining]:
        integer_targets[index] += 1
    targets = dict(zip(SPLIT_NAMES, integer_targets))
    label_targets = {
        name: {code: total_labels[code] * ratio for code in classes}
        for name, ratio in zip(SPLIT_NAMES, ratios)
    }
    total_label_occurrences = sum(total_labels.values())
    label_volume_targets = {
        name: total_label_occurrences * ratio
        for name, ratio in zip(SPLIT_NAMES, ratios)
    }
    assigned_groups = {name: [] for name in SPLIT_NAMES}
    document_counts = Counter()
    label_counts = {name: Counter() for name in SPLIT_NAMES}

    for _, _, _, _, identifier, counts in group_stats:
        group_size = len(grouped[identifier])
        within_capacity = [
            name
            for name in SPLIT_NAMES
            if document_counts[name] + group_size <= targets[name]
        ]
        eligible = within_capacity or list(SPLIT_NAMES)
        candidates = []
        for split_index, name in enumerate(SPLIT_NAMES):
            if name not in eligible:
                continue
            overflow = max(
                0, document_counts[name] + group_size - targets[name]
            )
            group_label_count = sum(counts.values())
            class_need = sum(
                counts[code]
                * (label_targets[name][code] - label_counts[name][code])
                / max(label_targets[name][code], 1)
                for code in counts
            ) / max(group_label_count, 1)
            current_label_volume = sum(label_counts[name].values())
            volume_need = (
                label_volume_targets[name] - current_label_volume
            ) / max(label_volume_targets[name], 1)
            size_need = (
                targets[name] - document_counts[name]
            ) / max(targets[name], 1)
            need = 0.6 * class_need + 0.25 * volume_need + 0.15 * size_need
            candidates.append(
                (overflow, -need, split_index, name)
            )
        _, _, _, selected = min(candidates)
        assigned_groups[selected].append(identifier)
        document_counts[selected] += group_size
        label_counts[selected].update(counts)

    splits = {
        name: sorted(
            (
                document
                for identifier in assigned_groups[name]
                for document in grouped[identifier]
            ),
            key=lambda item: (item["external_id"], item["document_id"]),
        )
        for name in SPLIT_NAMES
    }
    assert_no_group_leakage(splits)
    return splits


def assert_no_group_leakage(splits: dict[str, list[dict]]) -> dict[str, int]:
    identifiers = {
        name: {
            document.get("group_id") or group_id(document["ementa"])
            for document in splits[name]
        }
        for name in SPLIT_NAMES
    }
    intersections = {
        "train_validation": len(identifiers["train"] & identifiers["validation"]),
        "train_test": len(identifiers["train"] & identifiers["test"]),
        "validation_test": len(
            identifiers["validation"] & identifiers["test"]
        ),
    }
    if any(intersections.values()):
        raise ValueError(f"Data leakage detectado entre os splits: {intersections}")
    return intersections
