package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/fsnotify/fsnotify"
)

const (
	stabilityPollInterval = 200 * time.Millisecond
	stabilityWindow       = 600 * time.Millisecond
)

type rootState struct {
	cancel  context.CancelFunc
	subdirs map[string]struct{}
}

type stabilityState struct {
	size       int64
	lastChange time.Time
}

var (
	watcherMu     sync.Mutex
	roots         = make(map[string]*rootState)
	stabilityMu   sync.Mutex
	stabilityMap  = make(map[string]*stabilityState)
	globalWatcher *fsnotify.Watcher
)

func main() {
	log.SetOutput(os.Stderr)

	var err error
	globalWatcher, err = fsnotify.NewWatcher()
	if err != nil {
		log.Fatalf("fsnotify: %v", err)
	}
	defer globalWatcher.Close()

	go consumeEvents()
	go stabilityTicker()

	go readStdin()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
}

func readStdin() {
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if line == "PING" {
			fmt.Println("PONG")
			continue
		}
		if strings.HasPrefix(line, "WATCH:") {
			p := strings.TrimPrefix(line, "WATCH:")
			addRoot(p)
			continue
		}
		if strings.HasPrefix(line, "UNWATCH:") {
			p := strings.TrimPrefix(line, "UNWATCH:")
			removeRoot(p)
			continue
		}
		log.Printf("unknown command: %s", line)
	}
}

func normalizeRoot(p string) string {
	abs, err := filepath.Abs(p)
	if err != nil {
		return filepath.Clean(p)
	}
	return abs
}

func addRoot(rootPath string) {
	rootPath = normalizeRoot(rootPath)
	watcherMu.Lock()
	defer watcherMu.Unlock()

	if _, ok := roots[rootPath]; ok {
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	rs := &rootState{cancel: cancel, subdirs: make(map[string]struct{})}
	roots[rootPath] = rs

	info, err := os.Stat(rootPath)
	if err != nil || !info.IsDir() {
		log.Printf("WATCH skip (not a dir): %s", rootPath)
		cancel()
		delete(roots, rootPath)
		return
	}

	registerDir(rootPath, rs)
	go func() {
		<-ctx.Done()
	}()
}

func removeRoot(rootPath string) {
	rootPath = normalizeRoot(rootPath)
	watcherMu.Lock()
	rs, ok := roots[rootPath]
	if !ok {
		watcherMu.Unlock()
		return
	}
	delete(roots, rootPath)
	watcherMu.Unlock()

	for sub := range rs.subdirs {
		_ = globalWatcher.Remove(sub)
	}
	rs.cancel()
}

func registerDir(dir string, rs *rootState) {
	dir = normalizeRoot(dir)
	_ = globalWatcher.Add(dir)
	rs.subdirs[dir] = struct{}{}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			child := filepath.Join(dir, e.Name())
			registerDir(child, rs)
		}
	}
}

func rootForPath(filePath string) (string, *rootState) {
	filePath = normalizeRoot(filePath)
	watcherMu.Lock()
	defer watcherMu.Unlock()
	for root, rs := range roots {
		if filePath == root || strings.HasPrefix(filePath, root+string(filepath.Separator)) {
			return root, rs
		}
	}
	return "", nil
}

func consumeEvents() {
	for {
		select {
		case ev, ok := <-globalWatcher.Events:
			if !ok {
				return
			}
			handleEvent(ev)
		case err, ok := <-globalWatcher.Errors:
			if !ok {
				return
			}
			log.Printf("watcher error: %v", err)
		}
	}
}

func handleEvent(ev fsnotify.Event) {
	path := normalizeRoot(ev.Name)

	if ev.Op&fsnotify.Create == fsnotify.Create {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			_, rs := rootForPath(path)
			if rs != nil {
				registerDir(path, rs)
			}
			return
		}
	}

	if ev.Op&(fsnotify.Create|fsnotify.Write) != 0 {
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			trackStability(path)
		}
	}
}

func trackStability(path string) {
	info, err := os.Stat(path)
	if err != nil {
		return
	}
	stabilityMu.Lock()
	defer stabilityMu.Unlock()
	stabilityMap[path] = &stabilityState{
		size:       info.Size(),
		lastChange: time.Now(),
	}
}

func stabilityTicker() {
	ticker := time.NewTicker(stabilityPollInterval)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		var ready []string

		stabilityMu.Lock()
		for path, st := range stabilityMap {
			if now.Sub(st.lastChange) < stabilityWindow {
				continue
			}
			info, err := os.Stat(path)
			if err != nil {
				delete(stabilityMap, path)
				continue
			}
			if info.IsDir() {
				delete(stabilityMap, path)
				continue
			}
			if info.Size() != st.size {
				st.size = info.Size()
				st.lastChange = now
				continue
			}
			ready = append(ready, path)
			delete(stabilityMap, path)
		}
		stabilityMu.Unlock()

		for _, p := range ready {
			fmt.Println(p)
		}
	}
}
