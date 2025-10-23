/**
git tag -f v1.0.84             
git push origin v1.0.84 --force

git tag v1.0.84
git push origin v1.0.84

xattr -cr "/Applications/BotFarmVolume_v1_0_84.app"

 */

// ps -p 81791 > /dev/null && echo "running" || echo "not running"

// CMD
// tasklist /FI "PID eq <PID>" | findstr /R "^[^I]" >nul && echo running || echo not running

// PowerShell
// if (Get-Process -Id <PID> -ErrorAction SilentlyContinue) { "running" } else { "not running" }

