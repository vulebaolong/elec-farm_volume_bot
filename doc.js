/**
git tag -f v1.0.85             
git push origin v1.0.85 --force

git tag v1.0.85
git push origin v1.0.85

xattr -cr "/Applications/BotFarmVolume_v1_0_85.app"

 */

// ps -p 81791 > /dev/null && echo "running" || echo "not running"

// CMD
// tasklist /FI "PID eq <PID>" | findstr /R "^[^I]" >nul && echo running || echo not running

// PowerShell
// if (Get-Process -Id <PID> -ErrorAction SilentlyContinue) { "running" } else { "not running" }

