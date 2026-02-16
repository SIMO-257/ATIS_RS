#!/bin/bash

PROJECT_NAME="questionnaire"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${PROJECT_NAME}_backup_${TIMESTAMP}"
ARCHIVE_NAME="${BACKUP_DIR}.tar.gz"

echo "Creating complete backup for transfer..."
mkdir -p $BACKUP_DIR

# 1. Save all Docker images
echo "Saving Docker images..."
docker compose config --images | xargs docker save -o $BACKUP_DIR/images.tar

# 2. Backup all volumes
echo "Backing up volumes..."
docker volume ls -q --filter "name=${PROJECT_NAME}" | while read volume; do
    echo "  → $volume"
    docker run --rm \
        -v $volume:/source:ro \
        -v $(pwd)/$BACKUP_DIR:/backup \
        ubuntu \
        tar czf /backup/${volume}.tar.gz -C /source .
done

# 3. Copy configuration files
echo "Copying configuration files..."
cp docker-compose.yml $BACKUP_DIR/
[ -f .env ] && cp .env $BACKUP_DIR/

# 4. Create restore script for your friend
cat > $BACKUP_DIR/RESTORE.sh << 'EOF'
#!/bin/bash

echo "========================================="
echo "Questionnaire Project Restoration"
echo "========================================="
echo ""

# Load images
echo "Step 1/3: Loading Docker images..."
docker load -i images.tar

# Create volumes and restore data
echo "Step 2/3: Restoring volumes..."
for volume_backup in *.tar.gz; do
    volume_name=$(basename $volume_backup .tar.gz)
    echo "  → Restoring $volume_name"
    docker volume create $volume_name
    docker run --rm \
        -v $volume_name:/target \
        -v $(pwd):/backup \
        ubuntu \
        tar xzf /backup/${volume_backup} -C /target
done

# Start the project
echo "Step 3/3: Starting containers..."
docker compose up -d

echo ""
echo "========================================="
echo "✓ Restoration complete!"
echo "========================================="
echo ""
echo "Your containers are now running:"
docker compose ps
echo ""
echo "Access the application at the ports shown above"

EOF

chmod +x $BACKUP_DIR/RESTORE.sh

# 5. Create README for your friend
cat > $BACKUP_DIR/README.txt << 'EOF'
QUESTIONNAIRE PROJECT - RESTORATION GUIDE
==========================================

PREREQUISITES:
- Docker installed
- Docker Compose installed

RESTORATION STEPS:

1. Extract this archive:
   tar -xzf questionnaire_backup_XXXXXX.tar.gz
   cd questionnaire_backup_XXXXXX/

2. Run the restore script:
   chmod +x RESTORE.sh
   ./RESTORE.sh

3. Wait for completion (this may take a few minutes)

4. Check running containers:
   docker compose ps

That's it! The application should now be running.

TROUBLESHOOTING:
- If you get permission errors, try: sudo ./RESTORE.sh
- To stop: docker compose down
- To restart: docker compose up -d
- To view logs: docker compose logs -f

EOF

# 6. Compress everything into a single file
echo "Creating archive..."
tar czf $ARCHIVE_NAME $BACKUP_DIR

# Cleanup temp directory
rm -rf $BACKUP_DIR

# Show results
echo ""
echo "========================================="
echo "✓ Backup complete!"
echo "========================================="
echo ""
echo "Archive created: $ARCHIVE_NAME"
echo "Size: $(du -h $ARCHIVE_NAME | cut -f1)"
echo ""
echo "Send this file to your friend:"
echo "  → $ARCHIVE_NAME"
echo ""
echo "Your friend just needs to:"
echo "  1. Extract: tar -xzf $ARCHIVE_NAME"
echo "  2. cd $BACKUP_DIR"
echo "  3. Run: ./RESTORE.sh"
echo ""