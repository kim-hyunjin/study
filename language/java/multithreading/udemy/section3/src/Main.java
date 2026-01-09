void main() {
    Thread thread = new Thread(new BlockingTask());
    thread.start();
    thread.interrupt();

    Thread longComputationThread = new Thread(new LongComputationTask(new BigInteger("2"), new BigInteger("10000000")));

//    longComputationThread.setDaemon(true);
    /** => 데몬 스레드란?
     * 1. 주 스레드의 작업을 돕는 보조적인 역할을 수행하는 스레드
     * 2. 주 스레드가 종료되면 데몬 스레드는 강제적으로 자동 종료된다.
     */
    longComputationThread.start();
    longComputationThread.interrupt();
}

private static class BlockingTask implements Runnable {

    @Override
    public void run() {
        try {
            Thread.sleep(10000);
        } catch (InterruptedException e) {
            System.out.println("Exiting blocking thread");
        }
    }
}

private static class LongComputationTask implements Runnable {
    private BigInteger base;
    private BigInteger power;

    public LongComputationTask(BigInteger base, BigInteger power) {
        this.base = base;
        this.power = power;
    }

    @Override
    public void run() {
        System.out.println(base+"^"+power+" = "+pow(base, power));
    }

    private BigInteger pow(BigInteger base, BigInteger power) {
        BigInteger result = BigInteger.ONE;
        for (BigInteger i = BigInteger.ZERO; i.compareTo(power) !=0; i = i.add(BigInteger.ONE)) {
            if (Thread.currentThread().isInterrupted()) {
                System.out.println("Prematurely interrupted");
                return BigInteger.ZERO;
            }
            result = result.multiply(base);
        }

        return result;
    }
}