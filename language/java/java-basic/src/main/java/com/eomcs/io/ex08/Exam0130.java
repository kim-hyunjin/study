// 메모리에서 데이터를 읽기 - 바이트 배열에서 String, int, boolean 값 읽기
package com.eomcs.io.ex08;

import java.io.ByteArrayInputStream;

public class Exam0130 {

  public static void main(String[] args) throws Exception {
    byte[] buf = {0x0b, 0x41, 0x42,
        (byte)0xea, (byte)0xb0, (byte)0x80,
        (byte)0xea, (byte)0xb0, (byte)0x81,
        (byte)0xea, (byte)0xb0, (byte)0x84,
        0x00, 0x00, 0x00, 0x1b, 0x01};

    // 첫번째 부품
    ByteArrayInputStream arrIn = new ByteArrayInputStream(buf);

    // 첫번째 부품을 다른 부품과 연결해 보자.
    // FileInputStream에 붙여서 사용했던 DataInputStream을
    // 이번에는 ByteArrayInputStream에 붙여 보자!
    // => 이렇게 플러그인처럼, 장신구처럼 해당 기능이 필요할 때 마다
    //    붙여 사용할 수 있는 객체를 "데코레이터(decorator)" 라 부른다.
    // 기존에 만든 기능을 재사용할 수 있어 유지보수에 좋다.
    // 붙이고 뗐다를 자유롭게 할 수 있어
    // 상속보다 기능확장이 편하다.
    //
    DataInputStream in = new DataInputStream(arrIn);

    Member member = new Member();

    member.name = in.readUTF();
    member.age = in.readInt();
    member.gender = in.readBoolean();

    in.close();

    System.out.println(member);
  }
}
