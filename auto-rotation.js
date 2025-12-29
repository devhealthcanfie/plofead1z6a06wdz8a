const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { createClient } = require('bedrock-protocol');

// Config settings (same as your bot.js)
const CONFIG = {
  SERVER_HOST: 'donutsmp.net',
  SERVER_PORT: 19132,
  SERVER_VERSION: '1.21.124',
  ACCOUNTS_FILE: './accounts.json',
  PROFILES_DIR: './profiles'
};

class AutoRotationBot {
  constructor() {
    this.accounts = {};
    this.bots = new Map();
    
    // Rotation settings
    this.rotationOrder = [
      "Smaile9546",    // Smaile
      "Arroz6530",     // Arroz
      "VAN3LL10",      // VAN3LL10
      "MJ2178",        // MJ2178  
      "BigOldFerb"     // BigOldFerb
    ];
    this.rotationInterval = null;
    this.rotationCount = 0;
    this.isRotating = false;
    this.rotationDelay = 30000; // 30 seconds between each account
    this.rotationLoopDelay = 30 * 60 * 1000; // 30 minutes between full rotations
    
    // Load accounts
    this.loadAccountsSync();
  }

  loadAccountsSync() {
    try {
      if (fsSync.existsSync(CONFIG.ACCOUNTS_FILE)) {
        const data = fsSync.readFileSync(CONFIG.ACCOUNTS_FILE, 'utf8');
        this.accounts = JSON.parse(data);
        console.log(`📂 Loaded ${Object.keys(this.accounts).length} accounts`);
      }
    } catch (error) {
      console.log('Starting with fresh accounts database');
      this.accounts = {};
    }
  }

  async saveAccounts() {
    try {
      await fs.writeFile(CONFIG.ACCOUNTS_FILE, JSON.stringify(this.accounts, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Error saving accounts:', error.message);
      return false;
    }
  }

  async connectAccount(accountName) {
    const account = this.accounts[accountName];
    
    if (!account) {
      console.log(`❌ Account "${accountName}" not found in accounts.json!`);
      console.log(`Available accounts: ${Object.keys(this.accounts).join(', ')}`);
      return false;
    }
    
    // Fix path format
    let profilePath = account.profilesFolder;
    if (profilePath.includes('\\')) {
      profilePath = profilePath.replace(/\\/g, '/');
    }
    if (!profilePath.startsWith('./')) {
      profilePath = './' + profilePath;
    }
    
    console.log(`🔗 ${accountName} connecting...`);
    
    return new Promise((resolve) => {
      try {
        const client = createClient({
          host: CONFIG.SERVER_HOST,
          port: CONFIG.SERVER_PORT,
          username: account.username,
          profilesFolder: profilePath,
          skipPing: true,
          connectTimeout: 45000,
          onMsaAuthCode: () => {
            console.log(`❌ ${accountName}: Profile missing or corrupted - needs authentication`);
          },
          version: CONFIG.SERVER_VERSION
        });
        
        // Store bot info
        const botInfo = {
          client: client,
          isConnected: false,
          username: account.username,
          lastActivity: Date.now(),
          disconnect: () => {
            try {
              client.close();
            } catch (e) {}
          }
        };
        
        this.bots.set(accountName, botInfo);
        
        // Handle spawn (successful connection)
        client.once('spawn', () => {
          console.log(`✅ ${accountName} - CONNECTED`);
          botInfo.isConnected = true;
          botInfo.username = client.username || account.username;
          resolve(true);
        });
        
        // Handle kick
        client.once('kick', (reason) => {
          console.log(`❌ ${accountName}: Kicked - ${reason}`);
          this.bots.delete(accountName);
          resolve(false);
        });
        
        // Handle disconnect
        client.once('disconnect', (reason) => {
          console.log(`🔌 ${accountName}: Disconnected - ${reason}`);
          this.bots.delete(accountName);
          resolve(false);
        });
        
        // Handle errors - ignore sendto errors
        client.on('error', (err) => {
          if (!err.message.includes('sendto')) {
            console.log(`⚠️ ${accountName} error: ${err.message}`);
          }
        });
        
        // Connection timeout
        setTimeout(() => {
          if (this.bots.has(accountName) && !this.bots.get(accountName).isConnected) {
            console.log(`❌ ${accountName}: Connection timeout`);
            try { client.close(); } catch {}
            this.bots.delete(accountName);
            resolve(false);
          }
        }, 60000);
        
      } catch (error) {
        console.log(`❌ ${accountName}: Connection failed - ${error.message}`);
        resolve(false);
      }
    });
  }

  async rotateAccount(accountName) {
    console.log(`\n🔄 ROTATING ${accountName}...`);
    
    const bot = this.bots.get(accountName);
    
    if (bot && bot.isConnected) {
      // Disconnect first
      console.log(`🔌 Disconnecting ${accountName}...`);
      try {
        bot.disconnect();
      } catch (e) {}
      this.bots.delete(accountName);
      
      // Wait a moment
      await this.sleep(3000);
    }
    
    // Reconnect
    console.log(`🔗 Reconnecting ${accountName}...`);
    const success = await this.connectAccount(accountName);
    
    if (success) {
      console.log(`✅ ${accountName} rotation completed`);
      return true;
    } else {
      console.log(`❌ ${accountName} rotation failed, will retry in next loop`);
      return false;
    }
  }

  async start() {
    console.log('='.repeat(60));
    console.log('🔄 AUTO ROTATION BOT SYSTEM'.padStart(45));
    console.log('='.repeat(60));
    console.log('🎯 Target Server:', CONFIG.SERVER_HOST);
    console.log('📦 Version:', CONFIG.SERVER_VERSION);
    console.log('='.repeat(60));
    console.log('\n🔄 ROTATION ORDER:');
    this.rotationOrder.forEach((acc, idx) => {
      console.log(`  ${idx + 1}. ${acc}`);
    });
    console.log('\n⏱️  30 minutes between each full rotation');
    console.log('⏳ 30 seconds between each account');
    console.log('='.repeat(60));
    
    // Connect all accounts first
    console.log('\n🚀 CONNECTING ALL ACCOUNTS...');
    let connectedCount = 0;
    
    for (const accountName of this.rotationOrder) {
      if (this.accounts[accountName]) {
        const success = await this.connectAccount(accountName);
        if (success) connectedCount++;
        
        // Wait 5 seconds between connections
        if (accountName !== this.rotationOrder[this.rotationOrder.length - 1]) {
          console.log(`⏳ Waiting 5 seconds...`);
          await this.sleep(5000);
        }
      } else {
        console.log(`⚠️  Account "${accountName}" not found in accounts.json`);
        console.log(`   Available: ${Object.keys(this.accounts).join(', ')}`);
      }
    }
    
    console.log(`\n📊 INITIAL CONNECTION: ${connectedCount}/${this.rotationOrder.length} connected`);
    
    if (connectedCount > 0) {
      // Wait 2 minutes before first rotation
      console.log(`\n⏳ Waiting 2 minutes before starting rotation loop...`);
      await this.sleep(120000);
      
      // Start rotation loop
      this.startRotationLoop();
    } else {
      console.log('❌ No accounts connected, cannot start rotation loop.');
    }
  }

  async startRotationLoop() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 STARTING ROTATION LOOP'.padStart(40));
    console.log('='.repeat(60));
    
    // Perform first rotation immediately
    this.performRotation();
    
    // Then every 30 minutes
    this.rotationInterval = setInterval(() => {
      this.performRotation();
    }, this.rotationLoopDelay);
    
    console.log(`\n✅ Rotation loop started!`);
    console.log(`⏭️ Next full rotation in 30 minutes`);
  }

  async performRotation() {
    if (this.isRotating) {
      console.log('🔄 Rotation already in progress, skipping...');
      return;
    }
    
    this.isRotating = true;
    this.rotationCount++;
    
    console.log(`\n` + '🔄'.repeat(20));
    console.log(`🔄 ROTATION LOOP #${this.rotationCount} STARTING`);
    console.log('🔄'.repeat(20));
    
    let successCount = 0;
    let failCount = 0;
    
    // Rotate accounts in specified order
    for (let i = 0; i < this.rotationOrder.length; i++) {
      const accountName = this.rotationOrder[i];
      
      console.log(`\n[${i + 1}/${this.rotationOrder.length}] Rotating ${accountName}...`);
      
      const success = await this.rotateAccount(accountName);
      if (success) successCount++;
      else failCount++;
      
      // Wait 30 seconds before next account (unless it's the last one)
      if (i < this.rotationOrder.length - 1) {
        console.log(`⏳ Waiting 30 seconds before next account...`);
        await this.sleep(this.rotationDelay);
      }
    }
    
    console.log(`\n` + '✅'.repeat(20));
    console.log(`✅ ROTATION LOOP #${this.rotationCount} COMPLETED`);
    console.log(`📊 Results: ${successCount} successful, ${failCount} failed`);
    console.log('✅'.repeat(20));
    
    // Show next rotation time
    const nextRotation = new Date(Date.now() + this.rotationLoopDelay);
    console.log(`⏭️ Next rotation: ${nextRotation.toLocaleTimeString()}`);
    
    this.isRotating = false;
  }

  stop() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
    
    console.log(`\n🛑 Disconnecting all bots...`);
    this.bots.forEach((bot, name) => {
      try {
        bot.disconnect();
        console.log(`✅ Disconnected ${name}`);
      } catch (error) {}
    });
    
    this.bots.clear();
    console.log('👋 Goodbye!');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Auto-start when script runs
async function main() {
  const botSystem = new AutoRotationBot();
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutdown requested...');
    botSystem.stop();
    process.exit(0);
  });
  
  // Start the system
  await botSystem.start();
  
  // Keep process running
  process.stdin.resume();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}