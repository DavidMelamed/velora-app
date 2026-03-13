import { Command } from 'commander'

const program = new Command()

program
  .name('velora-pipeline')
  .description('Velora data pipeline — Bronze/Silver/Gold medallion architecture')
  .version('0.0.0')

program
  .command('ingest')
  .description('Run data ingestion for a source')
  .requiredOption('-s, --source <source>', 'Data source (fars, arcgis, socrata)')
  .option('--state <stateCode>', '2-letter state code')
  .option('--limit <limit>', 'Max records to ingest', '1000')
  .action(async (options) => {
    console.log(`[Pipeline] Ingesting from ${options.source} (state: ${options.state || 'all'}, limit: ${options.limit})`)
    console.log('[Pipeline] Not yet implemented — pending Phase 0')
  })

program
  .command('validate')
  .description('Run quality gates on ingested data')
  .option('--state <stateCode>', '2-letter state code')
  .action(async (options) => {
    console.log(`[Pipeline] Running quality gates (state: ${options.state || 'all'})`)
    console.log('[Pipeline] Not yet implemented — pending Phase 0')
  })

program
  .command('status')
  .description('Show pipeline status')
  .action(async () => {
    console.log('[Pipeline] Status: IDLE')
    console.log('[Pipeline] No pipeline runs recorded')
  })

program.parse()
