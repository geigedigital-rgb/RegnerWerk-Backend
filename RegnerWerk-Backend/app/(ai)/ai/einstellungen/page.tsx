import type { Metadata } from "next";
import Link from "next/link";
import { OpsPage, PageHeader, Panel } from "@/components/ops/ui";

export const metadata: Metadata = { title: "KI-Einstellungen" };

export default function KiEinstellungenPage() {
  return (
    <OpsPage>
      <PageHeader
        eyebrow="KI"
        title="Einstellungen"
        description="Verbindungen und Alltag — Keys liegen in Railway, Status in der Admin-UI."
      />
      <Panel title="Telefonie & Keys">
        <p className="text-sm text-gray-600">
          Status von Telnyx, OpenAI und Voice Gateway siehst du unter{" "}
          <Link
            href="/ai/telefonie"
            className="font-medium text-aqua-deep hover:underline"
          >
            KI → Telefonie
          </Link>
          . API-Keys werden nicht in der Datenbank gespeichert.
        </p>
        <ul className="mt-3 list-inside list-disc text-sm text-gray-600">
          <li>
            <code className="text-xs">TELNYX_*</code> +{" "}
            <code className="text-xs">OPENAI_*</code> → Railway Voice Gateway
          </li>
          <li>
            Webhook Telnyx:{" "}
            <code className="text-xs">/api/webhooks/telnyx</code>
          </li>
          <li>
            Webhook OpenAI: <code className="text-xs">/openai/webhook</code>
          </li>
        </ul>
      </Panel>
    </OpsPage>
  );
}
