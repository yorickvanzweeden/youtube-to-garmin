"""Cloud Run Job entry point.

The cloud adapters are deliberately kept behind this small boundary so the
state machine can be tested without credentials or network access.
"""

import os
import sys


def main() -> int:
    job_id = os.environ.get("JOB_ID", "").strip()
    if not job_id:
        print("JOB_ID is required", file=sys.stderr)
        return 2
    print(f"worker scaffold received job {job_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
