# PCOP shared schemas — inter-stage data contracts.
# This package is the single source of truth for Python services.
# A TypeScript mirror is at pcop_schemas/ts/ for the client.

from .customer import CustomerRecord, CustomerSnapshot, BankCustomer
from .score import (
    ChurnScore,
    ReasonCodeV2,
    Survival,
    AnalyzeResponse,
    ModelComponentStatus,
    ModelHealthResponse,
    PipelineError,
)
from .signal import (
    SignalResult,
    AlarmPayload,
    ARGUSInput,
    ARGUSOutput,
)
from .action_plan import ActionPlan, CompassState
from .content import HeraldRequest, HeraldResponse
from .measurement import (
    ObservationResult,
    AttributeResult,
)
from .analytics import (
    OracleCycleResult,
    InsightCard,
)

__all__ = [
    "CustomerRecord",
    "CustomerSnapshot",
    "BankCustomer",
    "ChurnScore",
    "ReasonCodeV2",
    "Survival",
    "AnalyzeResponse",
    "ModelComponentStatus",
    "ModelHealthResponse",
    "PipelineError",
    "SignalResult",
    "AlarmPayload",
    "ARGUSInput",
    "ARGUSOutput",
    "ActionPlan",
    "CompassState",
    "HeraldRequest",
    "HeraldResponse",
    "ObservationResult",
    "AttributeResult",
    "OracleCycleResult",
    "InsightCard",
]
