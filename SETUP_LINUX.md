# Pomodoro App - Linux Server Setup Guide

## Prerequisites (already done)
- Node.js and npm installed
- Project uploaded to `/var/www/html/Pomodoro/`
- Dependencies installed (`npm install` already run)
- Apache with SSL (Let's Encrypt) already working for `https://rgbxyz.ddns.net`

---

## Step 1: Upload the Apache config file

Upload the `pomodoro-apache.conf` file (from this project) to your server, or create it manually via SSH.

## Step 2: SSH into your server and run these commands

```bash
# 1. Navigate to the project
cd /var/www/html/Pomodoro

# 2. Install PM2 (process manager to keep Node.js running)
sudo npm install -g pm2

# 3. Stop any existing server running on port 3000
# (if you already tested node server.js)
pkill -f "node server.js" 2>/dev/null || true

# 4. Start the Node.js server with PM2
pm2 start server.js --name pomodoro

# 5. Save the PM2 process list (auto-restart on reboot)
pm2 save

# 6. Generate and run the startup script
pm2 startup
# This will output a command for you to run - copy/paste and run it

# 7. Enable Apache proxy modules
sudo a2enmod proxy proxy_http proxy_balancer lbmethod_byrequests

# 8. Copy the Apache config file
# Upload pomodoro-apache.conf to your server first, then:
# OPTION A: If you want to keep your existing SSL config, just add the proxy lines to it
# OPTION B: If you want a separate config file:
sudo cp /path/to/pomodoro-apache.conf /etc/apache2/sites-available/pomodoro.conf

# NOTE: The config file I created has SSL cert paths for Let's Encrypt.
# If you ALREADY have an SSL VirtualHost for rgbxyz.ddns.net,
# you should ONLY add these lines to your EXISTING config instead:
#   ProxyPreserveHost On
#   ProxyPass /Pomodoro/api http://localhost:3000/api
#   ProxyPassReverse /Pomodoro/api http://localhost:3000/api
#   Alias /Pomodoro /var/www/html/Pomodoro/public
#   <Directory /var/www/html/Pomodoro/public>
#       Options Indexes FollowSymLinks
#       AllowOverride All
#       Require all granted
#   </Directory>

# If using a separate config file, enable it:
sudo a2ensite pomodoro.conf

# 9. Restart Apache
sudo systemctl restart apache2

# 10. Verify the Node.js server is running
pm2 status
# You should see "pomodoro" with status "online"
```

## Step 3: Test it

1. Open `https://rgbxyz.ddns.net/Pomodoro/` in your browser
2. The app should load (served by Apache)
3. Try adding a category - it should save (proxied to Node.js)
4. Try running a Pomodoro session - it should log the session
5. Check statistics - they should persist

## Troubleshooting

### If you get a 404 or the page doesn't load:
```bash
# Check Apache error logs
sudo tail -f /var/log/apache2/pomodoro-error.log

# Check that the public folder exists
ls -la /var/www/html/Pomodoro/public/
```

### If API calls fail (categories not saving):
```bash
# Check if Node.js is running
pm2 status

# Check Node.js logs
pm2 logs pomodoro

# Test the API directly on the server
curl http://localhost:3000/api/categories
```

### If proxy is not working:
```bash
# Verify proxy modules are enabled
sudo a2enmod -l | grep proxy

# Make sure Node.js is listening on port 3000
sudo netstat -tlnp | grep 3000
```

### Firewall issues:
Make sure port 3000 is NOT open to the public (it should only be accessible locally):
```bash
# Check if port 3000 is publicly accessible
sudo ss -tlnp | grep 3000
# It should show 127.0.0.1:3000 or 0.0.0.0:3000 - either is fine
# But your firewall should NOT have port 3000 open
```
