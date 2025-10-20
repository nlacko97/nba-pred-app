import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

console.log('Get injuries function!')

Deno.serve(async req => {
  const injuriesApiUrl = `https://www.rotowire.com/basketball/tables/injury-report.php?TEAM=ALL&pos=ALL`
  const injuriesResponse = await fetch(injuriesApiUrl)
  const injuries = await injuriesResponse.json()
  console.log(`found ${injuries.length} injuries`)

  return new Response(JSON.stringify(injuries), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    },
  })
})
