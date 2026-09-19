# AI governance

No AI feature is presented as active in the current product. This is intentional: the imported project had no configured model integration, extraction pipeline, confidence model, or human-review persistence.

When AI is added, each suggestion must carry model metadata, generated timestamp, confidence where applicable, source/reference, and human review status. AI suggestions must remain separate from verified metric values and must never approve, fabricate, or silently modify compliance data.