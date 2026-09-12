package com.njust.campusmap;

import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;
import android.view.Surface;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Screen-top compass bearing. Never substitutes GPS travel bearing for orientation. */
@CapacitorPlugin(name = "Heading")
public class HeadingPlugin extends Plugin implements SensorEventListener {
    private SensorManager manager;
    private Sensor rotation, accelerometer, magnetometer;
    private boolean requested, listening, hasGravity, hasMagnetic;
    private boolean foreground = true;
    private final float[] gravity = new float[3], magnetic = new float[3];
    private final float[] matrix = new float[9], screenMatrix = new float[9];
    private int accuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
    private long lastEmission;
    private Float declination;

    @Override public void load() {
        manager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (manager == null) return;
        rotation = manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (rotation == null) rotation = manager.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR);
        accelerometer = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        magnetometer = manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
    }

    @PluginMethod public void start(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            requested = true;
            if (!foreground) { call.resolve(); return; }
            if (!begin()) {
                requested = false;
                call.reject("这台手机不支持指南针", "UNAVAILABLE");
            } else call.resolve();
        });
    }

    @PluginMethod public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            requested = false;
            end();
            call.resolve();
        });
    }

    @PluginMethod public void setLocation(PluginCall call) {
        Double latitude = call.getDouble("latitude"), longitude = call.getDouble("longitude");
        if (latitude == null || longitude == null || !Double.isFinite(latitude) || !Double.isFinite(longitude)
            || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            call.reject("无效的位置");
            return;
        }
        getActivity().runOnUiThread(() -> {
            declination = new GeomagneticField(latitude.floatValue(), longitude.floatValue(), 0, System.currentTimeMillis()).getDeclination();
            call.resolve();
        });
    }

    private boolean begin() {
        if (listening) return true;
        if (manager == null) return false;
        accuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
        hasGravity = hasMagnetic = false;
        lastEmission = 0;
        if (rotation != null) {
            listening = manager.registerListener(this, rotation, SensorManager.SENSOR_DELAY_GAME);
        } else if (accelerometer != null && magnetometer != null) {
            listening = manager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME)
                && manager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_GAME);
        }
        if (!listening) manager.unregisterListener(this);
        emitStatus(listening ? "initializing" : "unavailable");
        return listening;
    }

    private void end() {
        if (manager != null) manager.unregisterListener(this);
        listening = false;
    }

    private void emitStatus(String status) {
        JSObject result = new JSObject();
        result.put("status", status);
        notifyListeners("heading", result);
    }

    @Override protected void handleOnPause() {
        foreground = false;
        end();
        emitStatus("paused");
    }

    @Override protected void handleOnResume() { foreground = true; if (requested) begin(); }
    @Override protected void handleOnDestroy() { requested = false; end(); }

    @Override public void onAccuracyChanged(Sensor sensor, int value) {
        if (sensor == rotation || sensor == magnetometer) accuracy = value;
    }

    @Override public void onSensorChanged(SensorEvent event) {
        if (!listening) return;
        if (event.sensor == rotation) {
            accuracy = event.accuracy;
            SensorManager.getRotationMatrixFromVector(matrix, event.values);
        } else {
            if (event.sensor == accelerometer) {
                System.arraycopy(event.values, 0, gravity, 0, 3);
                hasGravity = true;
            } else if (event.sensor == magnetometer) {
                System.arraycopy(event.values, 0, magnetic, 0, 3);
                hasMagnetic = true;
                accuracy = event.accuracy;
            }
            if (!hasGravity || !hasMagnetic) return;
            if (!SensorManager.getRotationMatrix(matrix, null, gravity, magnetic)) {
                emitStatus("unreliable");
                return;
            }
        }
        long now = SystemClock.elapsedRealtime();
        if (now - lastEmission < 100) return;
        lastEmission = now;
        int x = SensorManager.AXIS_X, y = SensorManager.AXIS_Y;
        int displayRotation = getActivity().getWindowManager().getDefaultDisplay().getRotation();
        switch (displayRotation) {
            case Surface.ROTATION_90: x = SensorManager.AXIS_Y; y = SensorManager.AXIS_MINUS_X; break;
            case Surface.ROTATION_180: x = SensorManager.AXIS_MINUS_X; y = SensorManager.AXIS_MINUS_Y; break;
            case Surface.ROTATION_270: x = SensorManager.AXIS_MINUS_Y; y = SensorManager.AXIS_X; break;
            default: break;
        }
        SensorManager.remapCoordinateSystem(matrix, x, y, screenMatrix);
        // The screen's top edge projected onto the ground becomes undefined when vertical.
        if (Math.hypot(screenMatrix[1], screenMatrix[4]) < 0.15) {
            emitStatus("tilted");
            return;
        }
        if (accuracy <= SensorManager.SENSOR_STATUS_UNRELIABLE) {
            emitStatus("unreliable");
            return;
        }
        double magneticHeading = (Math.toDegrees(Math.atan2(screenMatrix[1], screenMatrix[4])) + 360) % 360;
        JSObject result = new JSObject();
        result.put("status", accuracy == SensorManager.SENSOR_STATUS_ACCURACY_LOW ? "low" : "ready");
        result.put("magneticHeading", magneticHeading);
        if (declination != null) result.put("trueHeading", (magneticHeading + declination + 360) % 360);
        result.put("timestamp", System.currentTimeMillis());
        notifyListeners("heading", result);
    }
}
