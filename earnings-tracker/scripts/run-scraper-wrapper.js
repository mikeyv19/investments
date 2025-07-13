// Set environment variables
process.env.SUPABASE_URL = 'https://borpmguppzkklueyzcew.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvcnBtZ3VwcHpra2x1ZXl6Y2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI0NTk0NCwiZXhwIjoyMDY3ODIxOTQ0fQ.W0uMd54-re9ySBK8QBe6zCagofXUAOEPU0FgQhH6LDE';

// Run the scraper
require('./scrape-watchlist-with-sec.js');