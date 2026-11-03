// Rejects access when the token belongs to a different bot than the D1 binding.
export async function assertBotBinding(env) {
 const binding=await env.DB.prepare("SELECT value FROM cloud_meta WHERE key='bot_id'").first();
 if(binding&&binding.value!==env.TELEGRAM_BOT_TOKEN.split(':')[0])throw new Error('D1 pertence a outro bot.');
}
