from sklearn.metrics import (
    accuracy_score,
    hamming_loss,
    jaccard_score,
    precision_recall_fscore_support,
)


def evaluate_multilabel(actual, predicted, classes: list[str]) -> dict:
    precision_micro, recall_micro, f1_micro, _ = precision_recall_fscore_support(
        actual, predicted, average="micro", zero_division=0
    )
    precision_macro, recall_macro, f1_macro, _ = precision_recall_fscore_support(
        actual, predicted, average="macro", zero_division=0
    )
    precision, recall, f1, support = precision_recall_fscore_support(
        actual, predicted, average=None, zero_division=0
    )
    return {
        "precision_micro": float(precision_micro),
        "recall_micro": float(recall_micro),
        "f1_micro": float(f1_micro),
        "precision_macro": float(precision_macro),
        "recall_macro": float(recall_macro),
        "f1_macro": float(f1_macro),
        "subset_accuracy": float(accuracy_score(actual, predicted)),
        "hamming_loss": float(hamming_loss(actual, predicted)),
        "jaccard_samples": float(
            jaccard_score(actual, predicted, average="samples", zero_division=0)
        ),
        "per_class": [
            {
                "code": code,
                "support": int(class_support),
                "precision": float(class_precision),
                "recall": float(class_recall),
                "f1": float(class_f1),
            }
            for code, class_support, class_precision, class_recall, class_f1 in zip(
                classes, support, precision, recall, f1
            )
        ],
    }
