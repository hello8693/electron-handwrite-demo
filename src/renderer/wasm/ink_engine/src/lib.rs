use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn build_mesh(points: &[f32], widths: &[f32], color: &[f32]) -> Vec<f32> {
    let n = points.len() / 2;
    if n == 0 {
        return Vec::new();
    }
    let r = *color.get(0).unwrap_or(&0.0);
    let g = *color.get(1).unwrap_or(&0.0);
    let b = *color.get(2).unwrap_or(&0.0);
    let a = *color.get(3).unwrap_or(&1.0);

    if n == 1 {
        let radius = widths.get(0).unwrap_or(&1.0) * 0.5;
        return circle_mesh(points[0], points[1], radius, r, g, b, a);
    }

    let mut dirs: Vec<(f32, f32)> = Vec::with_capacity(n - 1);
    let mut norms: Vec<(f32, f32)> = Vec::with_capacity(n - 1);
    for i in 0..(n - 1) {
        let x0 = points[i * 2];
        let y0 = points[i * 2 + 1];
        let x1 = points[(i + 1) * 2];
        let y1 = points[(i + 1) * 2 + 1];
        let dx = x1 - x0;
        let dy = y1 - y0;
        let len = (dx * dx + dy * dy).sqrt().max(1e-6);
        let dir = (dx / len, dy / len);
        dirs.push(dir);
        norms.push((-dir.1, dir.0));
    }

    let mut left_prev: Vec<(f32, f32)> = vec![(0.0, 0.0); n];
    let mut right_prev: Vec<(f32, f32)> = vec![(0.0, 0.0); n];
    let mut left_next: Vec<(f32, f32)> = vec![(0.0, 0.0); n];
    let mut right_next: Vec<(f32, f32)> = vec![(0.0, 0.0); n];
    let mut join: Vec<bool> = vec![true; n]; // true = miter, false = round

    for i in 0..n {
        let px = points[i * 2];
        let py = points[i * 2 + 1];
        let radius = widths.get(i).unwrap_or(&1.0) * 0.5;
        if i == 0 {
            let n0 = norms[0];
            left_prev[i] = (px + n0.0 * radius, py + n0.1 * radius);
            right_prev[i] = (px - n0.0 * radius, py - n0.1 * radius);
            left_next[i] = left_prev[i];
            right_next[i] = right_prev[i];
            continue;
        }
        if i == n - 1 {
            let n0 = norms[n - 2];
            left_prev[i] = (px + n0.0 * radius, py + n0.1 * radius);
            right_prev[i] = (px - n0.0 * radius, py - n0.1 * radius);
            left_next[i] = left_prev[i];
            right_next[i] = right_prev[i];
            continue;
        }

        let n0 = norms[i - 1];
        let n1 = norms[i];
        let miter = (n0.0 + n1.0, n0.1 + n1.1);
        let miter_len = (miter.0 * miter.0 + miter.1 * miter.1).sqrt();
        if miter_len < 1e-4 {
            left_prev[i] = (px + n0.0 * radius, py + n0.1 * radius);
            right_prev[i] = (px - n0.0 * radius, py - n0.1 * radius);
            left_next[i] = (px + n1.0 * radius, py + n1.1 * radius);
            right_next[i] = (px - n1.0 * radius, py - n1.1 * radius);
            join[i] = false;
            continue;
        }

        let mdir = (miter.0 / miter_len, miter.1 / miter_len);
        let dot = mdir.0 * n1.0 + mdir.1 * n1.1;
        let miter_length = if dot.abs() > 1e-6 { radius / dot } else { radius };
        let miter_limit = 4.0;

        if miter_length.abs() <= miter_limit * radius {
            left_prev[i] = (px + mdir.0 * miter_length, py + mdir.1 * miter_length);
            right_prev[i] = (px - mdir.0 * miter_length, py - mdir.1 * miter_length);
            left_next[i] = left_prev[i];
            right_next[i] = right_prev[i];
        } else {
            left_prev[i] = (px + n0.0 * radius, py + n0.1 * radius);
            right_prev[i] = (px - n0.0 * radius, py - n0.1 * radius);
            left_next[i] = (px + n1.0 * radius, py + n1.1 * radius);
            right_next[i] = (px - n1.0 * radius, py - n1.1 * radius);
            join[i] = false;
        }
    }

    let mut vertices: Vec<f32> = Vec::new();

    for i in 0..(n - 1) {
        let l0 = left_next[i];
        let r0 = right_next[i];
        let l1 = left_prev[i + 1];
        let r1 = right_prev[i + 1];
        push_tri(&mut vertices, l0, r0, r1, r, g, b, a);
        push_tri(&mut vertices, l0, r1, l1, r, g, b, a);
    }

    for i in 1..(n - 1) {
        if join[i] {
            continue;
        }
        let px = points[i * 2];
        let py = points[i * 2 + 1];
        let radius = widths.get(i).unwrap_or(&1.0) * 0.5;
        let d0 = dirs[i - 1];
        let d1 = dirs[i];
        let n0 = (-d0.1, d0.0);
        let n1 = (-d1.1, d1.0);
        let cross = d0.0 * d1.1 - d0.1 * d1.0;
        let outer0 = if cross >= 0.0 { n0 } else { (-n0.0, -n0.1) };
        let outer1 = if cross >= 0.0 { n1 } else { (-n1.0, -n1.1) };
        let mut a0 = outer0.1.atan2(outer0.0);
        let mut a1 = outer1.1.atan2(outer1.0);
        while a1 < a0 {
            a1 += std::f32::consts::PI * 2.0;
        }
        let angle = a1 - a0;
        let steps = ((angle / (std::f32::consts::PI / 8.0)).ceil() as usize).max(4);
        for s in 0..steps {
            let t0 = a0 + angle * (s as f32) / (steps as f32);
            let t1 = a0 + angle * ((s + 1) as f32) / (steps as f32);
            let p0 = (px + t0.cos() * radius, py + t0.sin() * radius);
            let p1 = (px + t1.cos() * radius, py + t1.sin() * radius);
            push_tri(&mut vertices, (px, py), p0, p1, r, g, b, a);
        }
    }

    // Round caps
    let (sx, sy) = (points[0], points[1]);
    let (ex, ey) = (points[(n - 1) * 2], points[(n - 1) * 2 + 1]);
    let n0 = norms[0];
    let n1 = norms[n - 2];
    cap_mesh(&mut vertices, (sx, sy), n0, widths.get(0).unwrap_or(&1.0) * 0.5, r, g, b, a);
    cap_mesh(&mut vertices, (ex, ey), n1, widths.get(n - 1).unwrap_or(&1.0) * 0.5, r, g, b, a);

    vertices
}


fn circle_mesh(cx: f32, cy: f32, radius: f32, r: f32, g: f32, b: f32, a: f32) -> Vec<f32> {
    let mut vertices = Vec::new();
    let steps = 24;
    for i in 0..steps {
        let a0 = (i as f32) / (steps as f32) * std::f32::consts::PI * 2.0;
        let a1 = ((i + 1) as f32) / (steps as f32) * std::f32::consts::PI * 2.0;
        let p0 = (cx + a0.cos() * radius, cy + a0.sin() * radius);
        let p1 = (cx + a1.cos() * radius, cy + a1.sin() * radius);
        push_tri(&mut vertices, (cx, cy), p0, p1, r, g, b, a);
    }
    vertices
}

fn cap_mesh(vertices: &mut Vec<f32>, center: (f32, f32), normal: (f32, f32), radius: f32, r: f32, g: f32, b: f32, a: f32) {
    let (cx, cy) = center;
    let mut a0 = (-normal.1).atan2(-normal.0);
    let mut a1 = normal.1.atan2(normal.0);
    while a1 < a0 {
        a1 += std::f32::consts::PI * 2.0;
    }
    let angle = a1 - a0;
    let steps = ((angle / (std::f32::consts::PI / 10.0)).ceil() as usize).max(6);
    for s in 0..steps {
        let t0 = a0 + angle * (s as f32) / (steps as f32);
        let t1 = a0 + angle * ((s + 1) as f32) / (steps as f32);
        let p0 = (cx + t0.cos() * radius, cy + t0.sin() * radius);
        let p1 = (cx + t1.cos() * radius, cy + t1.sin() * radius);
        push_tri(vertices, (cx, cy), p0, p1, r, g, b, a);
    }
}

fn push_tri(out: &mut Vec<f32>, a: (f32, f32), b: (f32, f32), c: (f32, f32), r: f32, g: f32, bcol: f32, acol: f32) {
    push_vertex(out, a.0, a.1, r, g, bcol, acol);
    push_vertex(out, b.0, b.1, r, g, bcol, acol);
    push_vertex(out, c.0, c.1, r, g, bcol, acol);
}

fn push_vertex(out: &mut Vec<f32>, x: f32, y: f32, r: f32, g: f32, b: f32, a: f32) {
    out.push(x);
    out.push(y);
    out.push(r);
    out.push(g);
    out.push(b);
    out.push(a);
}
