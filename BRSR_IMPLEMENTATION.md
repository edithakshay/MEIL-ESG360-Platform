# BRSR implementation

The schema treats BRSR questions as versioned metadata (`framework`, `frameworkVersion`, `section`, `questionCode`, `principleCode`, `requirementType`) and links metrics through a many-to-many mapping table. Readiness counts explicit responses and approved mapped metric values by Section A/B/C.

The current workspace provides:

- Section A, B, and C question navigation
- response persistence for the open reporting period
- metric-to-question count visibility
- readiness calculation
- report dataset generation with framework version and boundary
- lineage from a value through validation/evidence/approval to a report placeholder

The full SEBI question catalog, policy lifecycle, BRSR Core catalog, cross-references, regulatory applicability rules, and future-version administration should be loaded as reviewed metadata rather than hard-coded into React components.