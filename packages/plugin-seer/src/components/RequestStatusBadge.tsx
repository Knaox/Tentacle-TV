import { useTranslation } from "react-i18next";
import type { RequestStatus } from "../api/types";
import { STATUS_CONFIG } from "../utils/media-helpers";

interface RequestStatusBadgeProps {
  status: RequestStatus;
}

export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  const { t } = useTranslation("seer");
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
      {t(config.key)}
    </span>
  );
}
