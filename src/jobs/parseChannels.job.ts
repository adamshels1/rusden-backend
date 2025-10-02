import { supabase } from '../config/supabase';
import { parserService } from '../services/parserService';
import { listingService } from '../services/listingService';
import type { Channel } from '../types';

/**
 * Cron Job: Parse all active Telegram channels
 * Runs every 30 minutes via Vercel Cron
 */
export async function parseChannelsJob() {
  console.log('[Cron Job] Starting channel parsing...');

  try {
    // Get all active channels
    const { data: channels, error } = await supabase
      .from('channels')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch channels: ${error.message}`);
    }

    if (!channels || channels.length === 0) {
      console.log('[Cron Job] No active channels found');
      return;
    }

    console.log(`[Cron Job] Found ${channels.length} active channels`);

    // Parse each channel
    for (const channel of channels as Channel[]) {
      try {
        console.log(`[Cron Job] Parsing channel: ${channel.username}`);

        // Fetch new messages from Telegram
        const messages = await parserService.parseChannel(channel.username);

        if (messages.length === 0) {
          console.log(`[Cron Job] No new messages for ${channel.username}`);
          continue;
        }

        console.log(`[Cron Job] Found ${messages.length} new messages for ${channel.username}`);

        // Save raw messages to database
        const savedMessages = await parserService.saveRawMessages(channel.id, messages);

        console.log(`[Cron Job] Saved ${savedMessages.length} messages for ${channel.username}`);

        // Process messages through AI and create listings
        for (const rawMessage of savedMessages) {
          try {
            await listingService.processRawMessage(rawMessage.id);
          } catch (error) {
            console.error(`[Cron Job] Failed to process message ${rawMessage.id}:`, error);
            // Continue with other messages even if one fails
          }
        }

        // Update channel's updated_at timestamp
        await supabase
          .from('channels')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', channel.id);

      } catch (error) {
        console.error(`[Cron Job] Failed to parse channel ${channel.username}:`, error);
        // Continue with other channels even if one fails
      }
    }

    console.log('[Cron Job] Completed channel parsing');

  } catch (error) {
    console.error('[Cron Job] Fatal error:', error);
    throw error;
  }
}

// For manual execution: npm run parse:once
if (require.main === module) {
  parseChannelsJob()
    .then(() => {
      console.log('Job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Job failed:', error);
      process.exit(1);
    });
}
