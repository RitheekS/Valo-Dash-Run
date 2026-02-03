/**
 * Audio Manager for Valo Dash Run
 * Handles all sound effects and background music
 */

export class SoundManager {
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private currentBGM: HTMLAudioElement | null = null;
    private bgmVolume = 0.7; // 70% for background music
    private sfxVolume = 1.0; // 100% for sound effects

    constructor() {
        this.preloadSounds();
    }

    /**
     * Preload all audio files
     */
    private preloadSounds() {
        const audioFiles = {
            collectCoin: '/audio/collect coin.mp3',
            flashbang: '/audio/flashbang.mp3',
            killedByEnemy: '/audio/killed by enemy.mp3',
            obstacleHit: '/audio/obstacle hit.mp3',
            phase1BGM: '/audio/phase 1 bgm.mp3',
            phase2BGM: '/audio/phase 2 bgm.mp3',
            playerAttack: '/audio/player attack.mp3',
            redLanes: '/audio/red lanes.mp3',
        };

        for (const [key, path] of Object.entries(audioFiles)) {
            const audio = new Audio(path);
            audio.preload = 'auto';

            // Set volume based on type
            if (key.includes('BGM')) {
                audio.volume = this.bgmVolume;
                audio.loop = true; // Background music loops
            } else {
                audio.volume = this.sfxVolume;
            }

            this.sounds.set(key, audio);
        }
    }

    /**
     * Play a sound effect
     */
    playSound(soundName: string) {
        const sound = this.sounds.get(soundName);
        if (sound) {
            // Clone the audio for overlapping sounds
            const clone = sound.cloneNode(true) as HTMLAudioElement;
            clone.volume = sound.volume;
            clone.play().catch(err => console.warn(`Failed to play ${soundName}:`, err));
        }
    }

    /**
     * Play background music
     */
    playBGM(bgmName: string) {
        // Stop current BGM if playing
        if (this.currentBGM) {
            this.currentBGM.pause();
            this.currentBGM.currentTime = 0;
        }

        const bgm = this.sounds.get(bgmName);
        if (bgm) {
            this.currentBGM = bgm;
            bgm.currentTime = 0;
            bgm.play().catch(err => console.warn(`Failed to play BGM ${bgmName}:`, err));
        }
    }

    /**
     * Stop all background music
     */
    stopBGM() {
        if (this.currentBGM) {
            this.currentBGM.pause();
            this.currentBGM.currentTime = 0;
            this.currentBGM = null;
        }
    }

    /**
     * Stop all sounds
     */
    stopAll() {
        this.stopBGM();
        this.sounds.forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    }
}
