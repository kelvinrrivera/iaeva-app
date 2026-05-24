import { db } from '@/lib/database';
import { subscribeApp } from './meta-graph';
import type { Issue } from './health-types';

const SYSTEM_USER_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

const REQUIRED_FIELDS_CLOUD = ['messages', 'message_template_status_update'];
const REQUIRED_FIELDS_COEX = ['messages', 'smb_message_echoes', 'message_template_status_update'];

export async function autoRepair(shopId: string, issues: Issue[]): Promise<Issue[]> {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { metaBusinessAccountId: true, coexistenceMode: true, metaSubscribedFields: true },
  });
  if (!shop?.metaBusinessAccountId || !SYSTEM_USER_TOKEN) {
    return issues.map(i => ({ ...i, autoRepairResult: 'failed' as const }));
  }

  const required = shop.coexistenceMode ? REQUIRED_FIELDS_COEX : REQUIRED_FIELDS_CLOUD;

  const results: Issue[] = [];
  for (const issue of issues) {
    if (issue.code === 'SUBSCRIPTION_LOST' || issue.code === 'SUBSCRIPTION_FIELDS_INCOMPLETE') {
      try {
        await subscribeApp(shop.metaBusinessAccountId, SYSTEM_USER_TOKEN, required);
        await db.shop.update({
          where: { id: shopId },
          data: { metaSubscribedFields: required },
        });
        results.push({ ...issue, autoRepairResult: 'repaired' });
      } catch (err) {
        console.error(`[auto-repair] Failed to repair ${issue.code} for shop ${shopId}:`, err);
        results.push({ ...issue, autoRepairResult: 'failed' });
      }
    } else {
      results.push(issue);
    }
  }
  return results;
}
