export interface PlayerCampaignSource {
  id: string;
  name: string;
  updatedAt: Date | string | null;
}

export interface PlayerSafeCampaign {
  id: string;
  name: string;
  updatedAt: Date | string | null;
}

/**
 * Player-facing campaign contract.
 *
 * Intentionally excludes `description` and `settings`, because campaign-level
 * metadata can contain prep notes, private toggles or future GM-only config.
 */
export function projectCampaignForPlayer(
  campaign: PlayerCampaignSource,
): PlayerSafeCampaign {
  return {
    id: campaign.id,
    name: campaign.name,
    updatedAt: campaign.updatedAt,
  };
}

export function projectCampaignsForPlayer(
  campaigns: readonly PlayerCampaignSource[],
): PlayerSafeCampaign[] {
  return campaigns.map(projectCampaignForPlayer);
}
