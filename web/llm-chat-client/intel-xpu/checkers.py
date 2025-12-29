#!/usr/bin/env python3
"""
3‑D Checkers – Pygame + PyOpenGL
================================

Requirements
------------
    pip install pygame PyOpenGL PyOpenGL_accelerate numpy

Run
---
    python checkers.py

Controls
--------
 * Left‑click          – select / move a piece
 * Left‑drag           – rotate camera
 * Mouse wheel         – zoom in/out
 * Space bar           – toggle AI for the black player
 * Esc                 – quit

Features
--------
 * Real 3‑D board + pieces (OpenGL + GLU)
 * AI moves after a 1‑second delay
 * Modal “Game Over” dialog that shows the winner
"""

import math
import random
import pygame
from pygame.locals import *

# ------------------------------------------------------------------
# Optional NumPy check – needed for gluUnProject
# ------------------------------------------------------------------
try:
    import numpy as np
except Exception:
    print("\nERROR: NumPy is not installed.")
    print("Install it with:\n    pip install numpy")
    exit(1)

# ------------------------------------------------------------------
# OpenGL – import everything we’ll use
# ------------------------------------------------------------------
try:
    from OpenGL.GL import *
    from OpenGL.GLU import *
except Exception as e:
    print("\nERROR: PyOpenGL is not installed.")
    print("Install it with:\n    pip install PyOpenGL PyOpenGL_accelerate")
    exit(1)

# ------------------------------------------------------------------
# Basic constants
# ------------------------------------------------------------------
RED   = (1.0, 0.0, 0.0, 1.0)
BLUE  = (0.0, 0.0, 1.0, 1.0)
RED_K  = (1.0, 0.5, 0.5, 1.0)
BLUE_K = (0.5, 0.5, 1.0, 1.0)

# ------------------------------------------------------------------
# Piece & Board logic (fixed capture recursion)
# ------------------------------------------------------------------
class Piece:
    def __init__(self, color, king=False):
        self.color = color
        self.king  = king

class Board:
    def __init__(self):
        self.grid = [[None]*8 for _ in range(8)]
        self.setup()

    def setup(self):
        for r in range(8):
            for c in range(8):
                if (r+c)%2==1:
                    if r<3: self.grid[r][c] = Piece(RED)
                    elif r>4: self.grid[r][c] = Piece(BLUE)

    def get(self,r,c): return self.grid[r][c] if 0<=r<8 and 0<=c<8 else None
    def set(self,r,c,p): self.grid[r][c] = p
    def remove(self,r,c): self.grid[r][c] = None

    # ---------- move generation ----------
    def get_valid_moves(self,r,c):
        piece = self.get(r,c)
        if not piece: return {}
        dirs = []
        if piece.king or piece.color==RED: dirs += [( 1,-1),( 1, 1)]
        if piece.king or piece.color==BLUE: dirs += [(-1,-1),(-1, 1)]
        captures = self._search_captures(r,c,dirs,[],set(),piece)
        if captures: return captures
        moves={}
        for dr,dc in dirs:
            nr,nc=r+dr, c+dc
            if 0<=nr<8 and 0<=nc<8 and not self.get(nr,nc):
                moves[(nr,nc)]=[]
        return moves

    def _search_captures(self, r, c, dirs, path, visited, moving_piece):
        """Recursively find all capture sequences for the piece that started at (r,c)."""
        res={}
        for dr,dc in dirs:
            mr,mc=r+dr, c+dc
            nr,nc=r+2*dr, c+2*dc
            if not (0<=nr<8 and 0<=nc<8): continue
            mid=self.get(mr,mc)
            dst=self.get(nr,nc)
            if mid and mid.color!=moving_piece.color and not dst:
                if (mr,mc) in visited: continue
                new_path=path+[(mr,mc)]
                new_vis=visited|{(mr,mc)}
                sub=self._search_captures(nr,nc,dirs,new_path,new_vis,moving_piece)
                if sub:
                    for end,sub_path in sub.items():
                        res[end]=new_path+sub_path
                else:
                    res[(nr,nc)]=new_path
        return res

    # ---------- move execution ----------
    def execute_move(self,sr,sc,dr,dc):
        moves=self.get_valid_moves(sr,sc)
        if (dr,dc) not in moves: return False
        for cr,cc in moves[(dr,dc)]: self.remove(cr,cc)
        piece=self.get(sr,sc)
        self.set(dr,dc,piece)
        self.remove(sr,sc)
        if piece.color==RED and dr==7: piece.king=True
        if piece.color==BLUE and dr==0: piece.king=True
        return True

    # ---------- utility ----------
    def has_moves(self,color):
        for r in range(8):
            for c in range(8):
                p=self.get(r,c)
                if p and p.color==color and self.get_valid_moves(r,c):
                    return True
        return False

# ------------------------------------------------------------------
# Game state
# ------------------------------------------------------------------
board = Board()
turn  = RED
selected = None
valid_moves = {}
ai_enabled = False
ai_delay   = 0.0          # seconds remaining before AI can move
game_over  = False
winner     = ""

# ------------------------------------------------------------------
# Camera
# ------------------------------------------------------------------
cam_dist   = 20.0          # start farther away
cam_azim   = math.pi / 4
cam_elev   = math.pi / 6
prev_mouse = None

# ------------------------------------------------------------------
# Pygame/OpenGL init
# ------------------------------------------------------------------
pygame.init()
width, height = 800, 600
pygame.display.set_mode((width, height), pygame.DOUBLEBUF | pygame.OPENGL)
pygame.display.set_caption("3‑D Checkers – Pygame + PyOpenGL")
clock = pygame.time.Clock()

# OpenGL setup
glEnable(GL_DEPTH_TEST)
glClearColor(0.2, 0.2, 0.2, 1.0)   # darker background

def set_perspective():
    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    gluPerspective(45.0, width/float(height), 0.1, 200.0)
    glMatrixMode(GL_MODELVIEW)

set_perspective()

# ------------------------------------------------------------------
# Helper functions
# ------------------------------------------------------------------
def draw_board():
    glBegin(GL_QUADS)
    for r in range(8):
        for c in range(8):
            color = (0.9,0.9,0.9,1.0) if (r+c)%2==0 else (0.3,0.3,0.3,1.0)
            glColor4f(*color)
            glVertex3f(c,     0.0, r)
            glVertex3f(c + 1, 0.0, r)
            glVertex3f(c + 1, 0.0, r + 1)
            glVertex3f(c,     0.0, r + 1)
    glEnd()

    if selected:
        r,c = selected
        glColor4f(1.0,1.0,0.0,0.5)
        glBegin(GL_QUADS)
        glVertex3f(c,     0.01, r)
        glVertex3f(c + 1, 0.01, r)
        glVertex3f(c + 1, 0.01, r + 1)
        glVertex3f(c,     0.01, r + 1)
        glEnd()

    glColor4f(0.0,1.0,0.0,0.5)
    for (r,c) in valid_moves:
        glBegin(GL_QUADS)
        glVertex3f(c,     0.01, r)
        glVertex3f(c + 1, 0.01, r)
        glVertex3f(c + 1, 0.01, r + 1)
        glVertex3f(c,     0.01, r + 1)
        glEnd()

def draw_pieces():
    for r in range(8):
        for c in range(8):
            piece = board.get(r,c)
            if piece:
                glPushMatrix()
                glTranslatef(c + 0.5, 0.3, r + 0.5)
                color = RED_K if piece.king and piece.color==RED else \
                        BLUE_K if piece.king and piece.color==BLUE else \
                        RED if piece.color==RED else BLUE
                glColor4f(*color)
                quad = gluNewQuadric()
                gluQuadricNormals(quad, GLU_SMOOTH)
                gluSphere(quad, 0.3, 12, 12)
                gluDeleteQuadric(quad)
                glPopMatrix()

def pick_board(mx, my):
    """Return (row,col) under mouse or None."""
    modelview = glGetDoublev(GL_MODELVIEW_MATRIX)
    projection = glGetDoublev(GL_PROJECTION_MATRIX)
    viewport = glGetIntegerv(GL_VIEWPORT)

    win_y = height - my
    near_pt = gluUnProject(mx, win_y, 0.0, modelview, projection, viewport)
    far_pt  = gluUnProject(mx, win_y, 1.0, modelview, projection, viewport)
    if near_pt is None or far_pt is None:
        return None

    dir_vec = [far_pt[i] - near_pt[i] for i in range(3)]
    if abs(dir_vec[1]) < 1e-6:
        return None
    t = -near_pt[1] / dir_vec[1]
    if t < 0:
        return None
    ix = near_pt[0] + dir_vec[0] * t
    iz = near_pt[2] + dir_vec[2] * t
    col = int(ix)
    row = int(iz)
    if 0<=row<8 and 0<=col<8:
        return row, col
    return None

def ai_move():
    """Random legal move for the black player."""
    moves=[]
    for r in range(8):
        for c in range(8):
            piece=board.get(r,c)
            if piece and piece.color==BLUE:
                dests=board.get_valid_moves(r,c)
                for dst,cap in dests.items():
                    moves.append(((r,c),dst,cap))
    if not moves: return
    (sr,sc),(dr,dc),_ = random.choice(moves)
    board.execute_move(sr,sc,dr,dc)
    global turn
    turn = RED

def update_game_over():
    """Set global flags if someone has won or if it's a draw."""
    global game_over, winner
    if not board.has_moves(RED) and not board.has_moves(BLUE):
        winner = "Draw"
        game_over = True
    elif not board.has_moves(RED):
        winner = "Blue"
        game_over = True
    elif not board.has_moves(BLUE):
        winner = "Red"
        game_over = True

def draw_overlay():
    """Semi‑transparent black overlay + winner text."""
    glMatrixMode(GL_PROJECTION)
    glPushMatrix()
    glLoadIdentity()
    gluOrtho2D(0, width, 0, height)
    glMatrixMode(GL_MODELVIEW)
    glPushMatrix()
    glLoadIdentity()

    glDisable(GL_DEPTH_TEST)
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)

    # Fullscreen dark rectangle
    glColor4f(0,0,0,0.7)
    glBegin(GL_QUADS)
    glVertex2f(0,0)
    glVertex2f(width,0)
    glVertex2f(width,height)
    glVertex2f(0,height)
    glEnd()

    # Winner text
    font = pygame.font.SysFont('Arial', 50)
    msg = f"Game Over – Winner: {winner}"
    surface = font.render(msg, True, (255,255,255))
    data = pygame.image.tostring(surface, "RGBA", True)
    w,h = surface.get_size()
    glWindowPos2d((width-w)//2, (height-h)//2)
    glDrawPixels(w, h, GL_RGBA, GL_UNSIGNED_BYTE, data)

    glPopMatrix()          # restore MODELVIEW
    glMatrixMode(GL_PROJECTION)
    glPopMatrix()
    glMatrixMode(GL_MODELVIEW)

# ------------------------------------------------------------------
# Main loop
# ------------------------------------------------------------------
running = True
while running:
    dt = clock.tick(60) / 1000.0          # delta‑time in seconds

    for event in pygame.event.get():
        if event.type == QUIT:
            running = False
        elif event.type == KEYDOWN:
            if event.key == K_ESCAPE:
                running = False
            elif event.key == K_SPACE:
                ai_enabled = not ai_enabled
        elif event.type == MOUSEBUTTONDOWN:
            if game_over:                   # ignore clicks after end
                continue
            if event.button == 1:  # left click
                pick = pick_board(event.pos[0], event.pos[1])
                if pick:
                    r,c = pick
                    piece = board.get(r,c)
                    if selected:
                        if board.execute_move(*selected, r, c):
                            turn = BLUE if turn==RED else RED
                            # Human just moved → start the AI delay
                            if ai_enabled: ai_delay = 1.0
                            update_game_over()
                        selected = None
                        valid_moves = {}
                    else:
                        if piece and piece.color==turn:
                            selected = (r,c)
                            valid_moves = board.get_valid_moves(r,c)
            elif event.button == 4:  # wheel up
                cam_dist -= 0.5
                cam_dist = max(6.0, cam_dist)
            elif event.button == 5:  # wheel down
                cam_dist += 0.5
                cam_dist = min(200.0, cam_dist)
        elif event.type == MOUSEMOTION:
            if event.buttons[0] and not game_over:   # left button held
                if prev_mouse is not None:
                    dx = event.pos[0] - prev_mouse[0]
                    dy = event.pos[1] - prev_mouse[1]
                    cam_azim -= dx * 0.005
                    cam_elev += dy * 0.005
                    cam_elev = max(-math.pi/2+0.1, min(math.pi/2-0.1, cam_elev))
                prev_mouse = event.pos
            else:
                prev_mouse = None

    # If the game is over, we just wait for user input to exit
    if not game_over:
        # Count down the AI delay timer
        if ai_delay > 0:
            ai_delay -= dt
        else:
            # AI move (only when it's really the AI's turn)
            if ai_enabled and turn==BLUE and board.has_moves(BLUE):
                ai_move()
                update_game_over()

    # Render
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glLoadIdentity()

    # Camera
    eye_x = cam_dist * math.cos(cam_elev) * math.sin(cam_azim)
    eye_y = cam_dist * math.sin(cam_elev)
    eye_z = cam_dist * math.cos(cam_elev) * math.cos(cam_azim)
    gluLookAt(eye_x, eye_y, eye_z,   # eye
              3.5, 0.0, 3.5,          # centre
              0.0, 1.0, 0.0)          # up

    draw_board()
    draw_pieces()

    # --- HUD ---------------------------------------------
    glDisable(GL_DEPTH_TEST)
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)

    font = pygame.font.SysFont('Arial', 20)
    hud_text = f"Turn: {'Red' if turn==RED else 'Blue'}  |  AI: {'On' if ai_enabled else 'Off'}"
    hud_surface = font.render(hud_text, True, (255,255,255))
    hud_data = pygame.image.tostring(hud_surface, "RGBA", True)
    glWindowPos2d(10, 10)                 # bottom‑left
    glDrawPixels(hud_surface.get_width(), hud_surface.get_height(),
                 GL_RGBA, GL_UNSIGNED_BYTE, hud_data)

    glEnable(GL_DEPTH_TEST)

    # --- GAME OVER overlay --------------------------------
    if game_over:
        draw_overlay()

    pygame.display.flip()

    # If game over and user pressed any key, exit
    if game_over:
        keys = pygame.key.get_pressed()
        if keys[K_ESCAPE] or any(keys):
            running = False

pygame.quit()